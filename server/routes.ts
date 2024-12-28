import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import {
  purchaseRequests,
  approvals,
  users,
  subPurposes,
  notifications,
  fileAttachments,
  insertSubPurposeSchema,
  companyBranding,
  insertUserSchema,
} from "@db/schema";
import { eq, and, desc } from "drizzle-orm";
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { format } from 'date-fns';
import { AppError, handleError } from './utils/errors';
import { analyzePurchaseRequestPriority } from './utils/anthropic';
import { mandatoryDepartments, canUserApprove } from './utils/auth';
import { Parser } from 'json2csv';
import * as XLSX from 'xlsx';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const fileFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (!file.originalname.match(/\.(jpg|JPG|jpeg|JPEG|png|PNG|gif|GIF)$/)) {
    return cb(new Error('Only image files are allowed!'));
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Maximum 5 files per request
  }
});

// Logo upload specific configuration
const logoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = 'uploads/logos';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    cb(null, `company-logo-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const logoUpload = multer({
  storage: logoStorage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for logos
    files: 1 // Only one logo at a time
  }
});

// Helper function to create notifications
async function createNotification(
  userId: number,
  title: string,
  message: string,
  type: string,
  requestId?: number
) {
  try {
    const [notification] = await db
      .insert(notifications)
      .values({
        userId,
        title,
        message,
        type,
        requestId,
        link: requestId ? `/requests/${requestId}` : undefined,
        isRead: false,
        createdAt: new Date(),
      })
      .returning();

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
}

// Cleanup old uploads
function cleanupUploads() {
  const uploadDir = 'uploads';
  if (!fs.existsSync(uploadDir)) return;

  fs.readdir(uploadDir, (err, files) => {
    if (err) {
      console.error('Error reading upload directory:', err);
      return;
    }

    const now = Date.now();
    files.forEach(file => {
      const filePath = path.join(uploadDir, file);
      fs.stat(filePath, (err, stats) => {
        if (err) {
          console.error(`Error getting stats for file ${file}:`, err);
          return;
        }

        // Remove files older than 24 hours
        if (now - stats.mtimeMs > 24 * 60 * 60 * 1000) {
          fs.unlink(filePath, err => {
            if (err) console.error(`Error deleting file ${file}:`, err);
          });
        }
      });
    });
  });
}

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);

  // Register route handlers
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Company branding routes
  app.post("/api/company/branding", logoUpload.single('logo'), async (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (req.user!.role !== "admin") {
      return res.status(403).json({ error: "Only admin can update company branding" });
    }

    try {
      const file = req.file;
      if (!file) {
        throw new AppError('No logo file provided', 400);
      }

      // Delete existing branding record if it exists
      await db.delete(companyBranding);

      const [branding] = await db.insert(companyBranding)
        .values({
          companyName: req.body.companyName || 'Default Company Name',
          primaryColor: req.body.primaryColor || '#191160',
          secondaryColor: req.body.secondaryColor || '#35bbba',
          accentColor: req.body.accentColor || '#7156a2',
          logoUrl: file.path,
          headerStyle: req.body.headerStyle || 'modern',
          footerText: req.body.footerText || '',
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      res.json(branding);
    } catch (error) {
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (e) {
          console.error(`Failed to delete uploaded file ${req.file.path}:`, e);
        }
      }
      next(error);
    }
  });

  // Error handling middleware
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Error:', err);
    const error = handleError(err);
    const status = error.status || 500;
    const message = error.message || "Internal Server Error";

    res.status(status).json({
      status: 'error',
      message,
      severity: error.status >= 500 ? 'error' : 'warning',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  });

  app.post("/api/requests/:id/approvals", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const requestId = parseInt(req.params.id);
      const canApprove = await canUserApprove(req.user!.id, requestId);
      if (!canApprove) {
        return res.status(403).json({ error: "Not authorized to approve this request" });
      }

      const [approval] = await db.insert(approvals)
        .values({
          requestId,
          approverId: req.user!.id,
          status: req.body.status,
          comments: req.body.comments,
          department: req.user!.department || '',
          isMandatory: mandatoryDepartments.includes(req.user!.department || ''),
        })
        .returning();

      if (approval) {
        const [request] = await db
          .select()
          .from(purchaseRequests)
          .where(eq(purchaseRequests.id, approval.requestId))
          .limit(1);

        if (request) {
          await createNotification(
            request.requesterId,
            `Purchase Request ${request.requestNumber} Status Update`,
            `Your purchase request ${request.requestNumber} has been ${approval.status} by ${req.user!.department}`,
            'approval_update',
            request.id
          );
        }
      }

      res.json(approval);
    } catch (error: any) {
      console.error("Error creating approval:", error);
      res.status(500).json({
        error: "Failed to create approval",
        message: error.message
      });
    }
  });

  app.get("/api/requests", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const [user] = await db.select()
        .from(users)
        .where(eq(users.id, req.user!.id))
        .limit(1);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      let requests;
      if (user.role === 'admin' || mandatoryDepartments.includes(user.department)) {
        requests = await db.query.purchaseRequests.findMany({
          with: {
            requester: true,
            approvals: {
              with: {
                approver: true
              }
            },
            subPurpose: true,
            attachments: true
          },
          orderBy: desc(purchaseRequests.createdAt)
        });
      } else {
        requests = await db.query.purchaseRequests.findMany({
          where: eq(purchaseRequests.requesterId, user.id),
          with: {
            requester: true,
            approvals: {
              with: {
                approver: true
              }
            },
            subPurpose: true,
            attachments: true
          },
          orderBy: desc(purchaseRequests.createdAt)
        });
      }

      res.json(requests);
    } catch (error: any) {
      console.error("Error fetching requests:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/requests", upload.array('files', 5), async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const requestData = JSON.parse(req.body.data);

      if (!Array.isArray(requestData.items) || requestData.items.length === 0) {
        return res.status(400).json({ error: "At least one item is required" });
      }

      for (const item of requestData.items) {
        if (!item.name || typeof item.name !== 'string' || item.name.trim() === '') {
          return res.status(400).json({ error: "Each item must have a valid name" });
        }
        if (typeof item.quantity !== 'number' || item.quantity <= 0) {
          return res.status(400).json({ error: "Each item must have a valid quantity" });
        }
        if (typeof item.estimatedCost !== 'number' || item.estimatedCost < 0) {
          return res.status(400).json({ error: "Each item must have a valid cost" });
        }
      }

      const files = req.files as Express.Multer.File[];

      const dateStr = format(new Date(), "yyyyMMdd");
      const requestNumber = `REQ/${dateStr}/${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

      const [request] = await db.insert(purchaseRequests)
        .values({
          ...requestData,
          requestNumber,
          requesterId: req.user!.id,
          status: requestData.status || "draft",
          items: requestData.items
        })
        .returning();

      if (files && files.length > 0) {
        const attachments = files.map(file => ({
          requestId: request.id,
          fileName: file.originalname,
          fileType: file.mimetype,
          fileSize: file.size,
          fileUrl: file.path
        }));

        try {
          await db.insert(fileAttachments).values(attachments);
        } catch (error) {
          files.forEach(file => {
            try {
              fs.unlinkSync(file.path);
            } catch (e) {
              console.error(`Failed to delete file ${file.path}:`, e);
            }
          });
          throw error;
        }
      }

      const createdRequest = await db.query.purchaseRequests.findFirst({
        where: eq(purchaseRequests.id, request.id),
        with: {
          requester: true,
          approvals: {
            with: {
              approver: true
            }
          },
          subPurpose: true,
          attachments: true
        }
      });

      res.json(createdRequest);
    } catch (error: any) {
      if (req.files) {
        const files = req.files as Express.Multer.File[];
        files.forEach(file => {
          try {
            fs.unlinkSync(file.path);
          } catch (e) {
            console.error(`Failed to delete file ${file.path}:`, e);
          }
        });
      }

      console.error("Error creating request:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/requests/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const requestId = parseInt(req.params.id);
      const request = await db.query.purchaseRequests.findFirst({
        where: eq(purchaseRequests.id, requestId),
        with: {
          requester: true,
          approvals: {
            with: {
              approver: true
            }
          },
          subPurpose: true,
          attachments: true
        }
      });

      if (!request) {
        return res.status(404).json({ error: "Request not found" });
      }

      const [user] = await db.select()
        .from(users)
        .where(eq(users.id, req.user!.id))
        .limit(1);

      const hasAccess = request.requesterId === user.id ||
        user.role === 'admin' ||
        mandatoryDepartments.includes(user.department);

      if (!hasAccess) {
        return res.status(403).json({ error: "Not authorized to access this request" });
      }

      res.json(request);
    } catch (error: any) {
      console.error("Error fetching request:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/attachments/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const [attachment] = await db.select()
        .from(fileAttachments)
        .where(eq(fileAttachments.id, parseInt(req.params.id)))
        .limit(1);

      if (!attachment) {
        return res.status(404).json({ error: "Attachment not found" });
      }

      const [request] = await db.select()
        .from(purchaseRequests)
        .where(eq(purchaseRequests.id, attachment.requestId))
        .limit(1);

      if (!request) {
        return res.status(404).json({ error: "Associated request not found" });
      }

      const [user] = await db.select()
        .from(users)
        .where(eq(users.id, req.user!.id))
        .limit(1);

      const hasAccess = request.requesterId === user.id ||
        user.role === 'admin' ||
        mandatoryDepartments.includes(user.department);

      if (!hasAccess) {
        return res.status(403).json({ error: "Not authorized to access this file" });
      }

      if (!fs.existsSync(attachment.fileUrl)) {
        return res.status(404).json({ error: "File not found on server" });
      }

      res.setHeader('Content-Type', attachment.fileType);
      res.setHeader('Content-Disposition', `attachment; filename="${attachment.fileName}"`);

      const fileStream = fs.createReadStream(attachment.fileUrl);
      fileStream.pipe(res);
    } catch (error: any) {
      console.error("Error downloading attachment:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/notifications", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const userNotifications = await db.query.notifications.findMany({
        where: eq(notifications.userId, req.user!.id),
        orderBy: desc(notifications.createdAt),
        with: {
          request: true
        }
      });

      res.json(userNotifications);
    } catch (error: any) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/notifications/:id/read", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const [notification] = await db
        .update(notifications)
        .set({ isRead: true })
        .where(
          and(
            eq(notifications.id, parseInt(req.params.id)),
            eq(notifications.userId, req.user!.id)
          )
        )
        .returning();

      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }

      res.json(notification);
    } catch (error: any) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ error: error.message });
    }
  });


  app.put("/api/requests/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const [currentRequest] = await db
        .select()
        .from(purchaseRequests)
        .where(eq(purchaseRequests.id, parseInt(req.params.id)))
        .limit(1);

      if (!currentRequest) {
        return res.status(404).json({ error: "Request not found" });
      }

      const userRole = req.user!.role;
      const userDepartment = req.user!.department;
      const isSpecialRole = ["CEO Office", "Director", "Finance"].includes(userDepartment);
      const isRequestOwner = currentRequest.requesterId === req.user!.id;

      if (userRole !== "admin" && !isSpecialRole && !isRequestOwner) {
        return res.status(403).json({ error: "Not authorized to modify this request" });
      }

      const [updatedRequest] = await db
        .update(purchaseRequests)
        .set({
          ...req.body,
          updatedAt: new Date(),
        })
        .where(eq(purchaseRequests.id, parseInt(req.params.id)))
        .returning();

      if (req.body.status && req.body.status !== currentRequest.status) {
        await createNotification(
          currentRequest.requesterId,
          `Purchase Request ${currentRequest.requestNumber} Status Update`,
          `Your purchase request ${currentRequest.requestNumber} has been ${req.body.status}`,
          'status_change',
          currentRequest.id
        );

        if (req.body.status === 'changes_requested') {
          await createNotification(
            currentRequest.requesterId,
            `Changes Requested: ${currentRequest.requestNumber}`,
            `Changes have been requested for your purchase request ${currentRequest.requestNumber}. Please review and update.`,
            'changes_requested',
            currentRequest.id
          );
        }
      }

      res.json(updatedRequest);
    } catch (error: any) {
      console.error("Error updating request:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/requests/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const [request] = await db
        .select()
        .from(purchaseRequests)
        .where(eq(purchaseRequests.id, parseInt(req.params.id)))
        .limit(1);

      if (!request) {
        return res.status(404).json({ error: "Request not found" });
      }

      const [requester] = await db
        .select()
        .from(users)
        .where(eq(users.id, request.requesterId))
        .limit(1);

      if (!requester) {
        return res.status(404).json({ error: "Requester not found" });
      }

      const isAdmin = req.user!.role === "admin";
      const isSameDepartment = requester.department === req.user!.department;
      const isDraft = request.status === "draft";

      if (!isAdmin && !(isSameDepartment && isDraft)) {
        return res.status(403).json({
          error: isDraft
            ? "Only users from the same department can delete draft requests"
            : "Only draft requests can be deleted by department users"
        });
      }

      const attachments = await db
        .select()
        .from(fileAttachments)
        .where(eq(fileAttachments.requestId, parseInt(req.params.id)));

      for (const attachment of attachments) {
        try {
          if (fs.existsSync(attachment.fileUrl)) {
            fs.unlinkSync(attachment.fileUrl);
          }
        } catch (error) {
          console.error(`Failed to delete file ${attachment.fileUrl}:`, error);
        }
      }

      if (attachments.length > 0) {
        await db
          .delete(fileAttachments)
          .where(eq(fileAttachments.requestId, parseInt(req.params.id)));
      }

      await db
        .delete(notifications)
        .where(eq(notifications.requestId, parseInt(req.params.id)));

      await db
        .delete(approvals)
        .where(eq(approvals.requestId, parseInt(req.params.id)));

      const [deletedRequest] = await db
        .delete(purchaseRequests)
        .where(eq(purchaseRequests.id, parseInt(req.params.id)))
        .returning();

      if (request.requesterId !== req.user!.id) {
        await createNotification(
          request.requesterId,
          `Request ${request.requestNumber} Deleted`,
          `Your request ${request.requestNumber} has been deleted by ${req.user!.department}`,
          'request_deleted'
        );
      }

      cleanupUploads();

      res.json({
        message: "Request deleted successfully",
        request: deletedRequest
      });
    } catch (error: any) {
      console.error("Error deleting request:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/approvals", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const canApprove = await canUserApprove(req.user!.id, req.body.requestId);
      if (!canApprove) {
        return res.status(403).json({ error: "Not authorized to approve this request" });
      }

      const [approval] = await db.insert(approvals)
        .values({
          requestId: req.body.requestId,
          approverId: req.user!.id,
          department: req.user!.department,
          status: req.body.status,
          comments: req.body.comments,
          isMandatory: mandatoryDepartments.includes(req.user!.department),
        })
        .returning();

      if (approval) {
        const [request] = await db
          .select()
          .from(purchaseRequests)
          .where(eq(purchaseRequests.id, approval.requestId))
          .limit(1);

        if (request) {
          await createNotification(
            request.requesterId,
            `Purchase Request ${request.requestNumber} Status Update`,
            `Your purchase request ${request.requestNumber} has been ${approval.status} by ${req.user!.department}`,
            'approval_update',
            request.id
          );
        }
      }

      res.json(approval);
    } catch (error: any) {
      console.error("Error creating approval:", error);
      res.status(500).json({
        error: "Failed to create approval",
        message: error.message
      });
    }
  });

  app.put("/api/approvals/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const [approval] = await db
        .update(approvals)
        .set({
          ...req.body,
          updatedAt: new Date()
        })
        .where(eq(approvals.id, parseInt(req.params.id)))
        .returning();

      if (!approval) {
        return res.status(404).json({ error: "Approval not found" });
      }

      const [request] = await db
        .select()
        .from(purchaseRequests)
        .where(eq(purchaseRequests.id, approval.requestId))
        .limit(1);

      if (request && req.body.status) {
        await createNotification(
          request.requesterId,
          `Approval Update`,
          `Your purchase request ${request.requestNumber} has been ${approval.status} by ${req.user!.department}`,
          'approval_update',
          request.id
        );
      }

      res.json(approval);
    } catch (error: any) {
      console.error("Error updating approval:", error);
      res.status(500).json({
        error: "Failed to update approval",
        message: error.message
      });
    }
  });

  app.get("/api/sub-purposes", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const purposeType = req.query.purposeType as string;
    try {
      const purposes = await db.select()
        .from(subPurposes)
        .where(purposeType ? eq(subPurposes.purposeType, purposeType) : undefined);

      res.json(purposes);
    } catch (error: any) {
      console.error("Error fetching sub-purposes:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/sub-purposes", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const result = insertSubPurposeSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: result.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        });
      }

      const [purpose] = await db.insert(subPurposes)
        .values(result.data)
        .returning();

      res.json(purpose);
    } catch (error: any) {
      console.error("Error creating sub-purpose:", error);
      res.status(500).json({
        error: "Failed to create sub-purpose",
        message: error.message
      });
    }
  });

  app.get("/api/admin/sub-purposes/:id/check-usage", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (req.user!.role !== "admin") {
      return res.status(403).json({ error: "Only admin can check sub-purpose usage" });
    }

    try {
      const [request] = await db
        .select()
        .from(purchaseRequests)
        .where(eq(purchaseRequests.subPurposeId, parseInt(req.params.id)))
        .limit(1);

      res.json({ isInUse: !!request });
    } catch (error: any) {
      console.error("Error checking sub-purpose usage:", error);
      res.status(500).json({
        error: "Failed to check sub-purpose usage",
        message: error.message
      });
    }
  });

  // Update the analyze-priority endpoint
  app.post("/api/requests/:id/analyze-priority", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401);
      }

      const requestId = parseInt(req.params.id);
      const [request] = await db.select()
        .from(purchaseRequests)
        .where(eq(purchaseRequests.id, requestId))
        .limit(1);

      if (!request) {
        throw new AppError('Request not found', 404);
      }

      // Calculate total estimated cost
      const itemsTotal = request.items.reduce(
        (sum, item: any) => sum + (Number(item.quantity) * Number(item.estimatedCost)),
        0
      );
      const totalEstimatedCost = itemsTotal + Number(request.freightAmount);

      // Analyze priority using Anthropic
      const priorityAnalysis = await analyzePurchaseRequestPriority({
        title: request.title,
        description: request.description,
        purpose: request.purpose,
        purposeType: request.purposeType,
        totalEstimatedCost,
        items: request.items.map((item: any) => ({
          name: item.name,
          quantity: Number(item.quantity),
          estimatedCost: Number(item.estimatedCost)
        }))
      });

      // Update request with priority analysis
      const [updatedRequest] = await db.update(purchaseRequests)
        .set({
          priority: priorityAnalysis.priority as string,
          priorityScore: priorityAnalysis.score,
          priorityReason: priorityAnalysis.reason,
          priorityRecommendations: priorityAnalysis.recommendations,
          updatedAt: new Date()
        })
        .where(eq(purchaseRequests.id, requestId))
        .returning();

      if (!updatedRequest) {
        throw new AppError('Failed to update request with priority analysis');
      }

      await createNotification(
        request.requesterId,
        `Priority Analysis: ${request.requestNumber}`,
        `Your purchase request ${request.requestNumber} has been analyzed. Priority: ${priorityAnalysis.priority.toUpperCase()}`,
        'priority_analysis',
        request.id
      );

      res.json(updatedRequest);
    } catch (error) {
      next(handleError(error));
    }
  });

  app.get("/api/requests/export", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const exportFormat = req.query.format as string || 'xlsx';
      const dateStr = format(new Date(), "yyyyMMdd");

      const requests = await db.query.purchaseRequests.findMany({
        with: {
          requester: true,
          approvals: {
            with: {
              approver: true
            }
          },
          subPurpose: true
        },
        orderBy: desc(purchaseRequests.createdAt)
      });

      const exportData = requests.map(request => ({
        'Request Number': request.requestNumber,
        'Title': request.title,
        'Description': request.description,
        'Status': request.status,
        'Priority': request.priority,
        'Priority Score': request.priorityScore,
        'Requester': request.requester.username,
        'Department': request.requester.department,
        'Purpose Type': request.purposeType,
        'Sub Purpose': request.subPurpose?.name || '',
        'Total Cost': Number(request.totalEstimatedCost),
        'Currency': request.currency,
        'Company Name': request.companyName,
        'Contact Person': request.contactPerson,
        'Contact Number': request.contactNumber,
        'Created At': request.createdAt ? format(new Date(request.createdAt), 'PPpp') : '',
        'Updated At': request.updatedAt ? format(new Date(request.updatedAt), 'PPpp') : '',
        'Approvals': request.approvals.map(a =>
          `${a.department}: ${a.status}`
        ).join('; '),
        'Items': request.items.map((item: any) =>
          `${item.name} (${item.quantity} x ${item.estimatedCost})`
        ).join('; ')
      }));

      if (exportFormat === 'csv') {
        const fields = Object.keys(exportData[0]);
        const parser = new Parser({ fields });
        const csv = parser.parse(exportData);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=procurement_report_${dateStr}.csv`);
        return res.send(csv);
      } else {
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Requests');

        const buffer = XLSX.write(workbook, {
          type: 'buffer',
          bookType: 'xlsx'
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=procurement_report_${dateStr}.xlsx`);
        res.send(buffer);
      }
    } catch (error: any) {
      console.error("Error exporting requests:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/sub-purposes", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (req.user!.role !== "admin") {
      return res.status(403).json({ error: "Only admin can manage subpurposes" });
    }

    try {
      const result = insertSubPurposeSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: result.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        });
      }

      const [purpose] = await db.insert(subPurposes)
        .values(result.data)
        .returning();

      res.json(purpose);
    } catch (error: any) {
      console.error("Error creating sub-purpose:", error);
      res.status(500).json({
        error: "Failed to create sub-purpose",
        message: error.message
      });
    }
  });

  app.put("/api/admin/sub-purposes/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (req.user!.role !== "admin") {
      return res.status(403).json({ error: "Only admin can manage sub-purposes" });
    }

    try {
      const result = insertSubPurposeSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: result.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        });
      }

      const [updatedPurpose] = await db.update(subPurposes)
        .set({
          ...result.data,
          updatedAt: new Date()
        })
        .where(eq(subPurposes.id, parseInt(req.params.id)))
        .returning();

      if (!updatedPurpose) {
        return res.status(404).json({ error: "Sub-purpose not found" });
      }

      res.json(updatedPurpose);
    } catch (error: any) {
      console.error("Error updating sub-purpose:", error);
      res.status(500).json({
        error: "Failed to update sub-purpose",
        message: error.message
      });
    }
  });

  app.delete("/api/admin/sub-purposes/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (req.user!.role !== "admin") {
      return res.status(403).json({ error: "Only admin can manage sub-purposes" });
    }

    try {
      const [request] = await db
        .select()
        .from(purchaseRequests)
        .where(eq(purchaseRequests.subPurposeId, parseInt(req.params.id)))
        .limit(1);

      if (request) {
        return res.status(400).json({
          error: "This sub-purpose is currently being used by one or more purchase requests. Please freeze it instead of deleting."
        });
      }

      const [deletedPurpose] = await db
        .delete(subPurposes)
        .where(eq(subPurposes.id, parseInt(req.params.id)))
        .returning();

      if (!deletedPurpose) {
        return res.status(404).json({ error: "Sub-purpose not found" });
      }

      res.json({ message: "Sub-purpose deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting sub-purpose:", error);

      if (error.code === '23503') {
        return res.status(400).json({
          error: "Cannot delete this sub-purpose as it is referenced by existing purchase requests. Please freeze it instead."
        });
      }

      res.status(500).json({
        error: "Failed to delete sub-purpose",
        message: error.message
      });
    }
  });

  app.post("/api/account-requests", async (req, res) => {
    try {
      const result = insertAccountRequestSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: result.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        });
      }

      const hashedPassword = await hashPassword(result.data.password);

      const [request] = await db.insert(accountRequests)
        .values({
          ...result.data,
          password: hashedPassword,
          status: "pending"
        })
        .returning();

      const admins = await db
        .select()
        .from(users)
        .where(eq(users.role, "admin"));

      for (const admin of admins) {
        await createNotification(
          admin.id,
          'New Account Request',
          `New account request from ${request.username} (${request.department})`,
          'account_request'
        );
      }

      res.json({
        message: "Account request submitted successfully. Your request is under review.",
        request: {
          id: request.id,
          username: request.username,
          email: request.email,
          department: request.department,
          status: request.status
        }
      });
    } catch (error: any) {
      console.error("Error creating account request:", error);
      res.status(500).json({
        error: "Failed to create account request",
        message: error.message
      });
    }
  });

  app.get("/api/admin/account-requests", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (req.user!.role !== "admin") {
      return res.status(403).json({ error: "Only admin can view account requests" });
    }

    try {
      const requests = await db
        .select()
        .from(accountRequests)
        .orderBy(desc(accountRequests.createdAt));

      res.json(requests);
    } catch (error: any) {
      console.error("Error fetching account requests:", error);
      res.status(500).json({
        error: "Failed to fetch account requests",
        message: error.message
      });
    }
  });

  app.post("/api/admin/account-requests/:id/approve", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (req.user!.role !== "admin") {
      return res.status(403).json({ error: "Only admin can approve account requests" });
    }

    try {
      const [accountRequest] = await db
        .select()
        .from(accountRequests)
        .where(eq(accountRequests.id, parseInt(req.params.id)))
        .limit(1);

      if (!accountRequest) {
        return res.status(404).json({ error: "Account request not found" });
      }


      const [newUser] = await db.insert(users)
        .values({
          username: accountRequest.username,
          password: accountRequest.password,
          email: accountRequest.email,
          contactNumber: accountRequest.contactNumber,
          department: accountRequest.department,
          role: accountRequest.role,
        })
        .returning();

      await db.update(accountRequests)
        .set({ status: "approved" })
        .where(eq(accountRequests.id, accountRequest.id));

      if (newUser) {
        await createNotification(
          newUser.id,
          `Account Approved`,
          "Your account request has been approved. You can now log in.",
          "account_approved"
        );
      }

      res.json({ message: "Account request approved successfully", user: newUser });
    } catch (error: any) {
      console.error("Error approving account request:", error);
      res.status(500).json({
        error: "Failed to approve account request",
        message: error.message
      });
    }
  });

  app.put("/api/account-requests/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (req.user!.role !== "admin") {
      return res.status(403).json({ error: "Only admin can manage account requests" });
    }

    try {
      const [request] = await db
        .update(accountRequests)
        .set({
          ...req.body,
          updatedAt: new Date()
        })
        .where(eq(accountRequests.id, parseInt(req.params.id)))
        .returning();

      if (!request) {
        return res.status(404).json({ error: "Account request not found" });
      }

      if (request.status === 'approved') {
        const hashedPassword = await hashPassword(request.password);
        const [newUser] = await db.insert(users)
          .values({
            username: request.username,
            password: hashedPassword,
            email: request.email,
            contactNumber: request.contactNumber,
            department: request.department,
            role: request.role || 'user'
          })
          .returning();

        if (newUser) {
          await createNotification(
            newUser.id,
            `Account Approved`,
            "Your account request has been approved. You can now log in.",
            "account_approved"
          );
        }
      } else if (request.status === 'rejected') {
        await createNotification(
          0,
          `Account Request Rejected`,
          `Account request for ${request.username} was rejected`,
          'account_rejected'
        );
      }

      res.json(request);
    } catch (error: any) {
      console.error("Error updating account request:", error);
      res.status(500).json({
        error: "Failed to update account request",
        message: error.message
      });
    }
  });

  app.post("/api/admin/account-requests/:id/reject", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (req.user!.role !== "admin") {
      return res.status(403).json({ error: "Only admin can reject account requests" });
    }

    try {
      const [request] = await db
        .update(accountRequests)
        .set({
          status: "rejected",
          updatedAt: new Date()
        })
        .where(eq(accountRequests.id, parseInt(req.params.id)))
        .returning();

      if (!request) {
        return res.status(404).json({ error: "Account request not found" });
      }

      res.json({ message: "Account request rejected successfully" });
    } catch (error: any) {
      console.error("Error rejecting account request:", error);
      res.status(500).json({
        error: "Failed to reject account request",
        message: error.message
      });
    }
  });

  app.get("/api/admin/users", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (req.user!.role !== "admin") {
      return res.status(403).json({ error: "Only admin can view all users" });
    }

    try {
      const allUsers = await db
        .select()
        .from(users)
        .orderBy(desc(users.id));

      res.json(allUsers);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      res.status(500).json({
        error: "Failed to fetch users",
        message: error.message
      });
    }
  });

  app.put("/api/admin/users/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (req.user!.role !== "admin") {
      return res.status(403).json({ error: "Only admin can modify users" });
    }

    try {
      const result = insertUserSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: result.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        });
      }

      const [updatedUser] = await db
        .update(users)
        .set(result.data)
        .where(eq(users.id, parseInt(req.params.id)))
        .returning();

      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(updatedUser);
    } catch (error: any) {
      console.error("Error updating user:", error);
      res.status(500).json({
        error: "Failed to update user",
        message: error.message
      });
    }
  });

  app.delete("/api/admin/users/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (req.user!.role !== "admin") {
      return res.status(403).json({ error: "Only admin can delete users" });
    }

    try {
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, parseInt(req.params.id)))
        .limit(1);

      if (!existingUser) {
        return res.status(404).json({ error: "User not found" });
      }

      await db
        .delete(notifications)
        .where(eq(notifications.userId, parseInt(req.params.id)));

      await db
        .delete(approvals)
        .where(eq(approvals.approverId, parseInt(req.params.id)));

      const [deletedUser] = await db
        .delete(users)
        .where(eq(users.id, parseInt(req.params.id)))
        .returning();

      res.json({ message: "User deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting user:", error);
      res.status(500).json({
        error: "Failed to delete user",
        message: error.message
      });
    }
  });

  // Remove duplicate company branding route

  // Add 404 handler for API routes
  app.use('/api/*', (req, res) => {
    res.status(404).json({ 
      status: 'error',
      message: `Cannot ${req.method} ${req.path}`,
      severity: 'warning'
    });
  });

  return httpServer;
}