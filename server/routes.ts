import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { db } from "@db";
import {
  purchaseRequests,
  approvals,
  users,
  subPurposes,
  notifications,
  fileAttachments,
  accountRequests,
  insertSubPurposeSchema,
  insertAccountRequestSchema,
  insertUserSchema,
  companyBranding,
  insertCompanyBrandingSchema,
} from "@db/schema";
import { eq, and, desc } from "drizzle-orm";
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { format } from 'date-fns';
import bcrypt from 'bcrypt';
import { Parser } from 'json2csv';
import * as XLSX from 'xlsx';


// Helper functions
async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

async function createNotification(userId: number, message: string, type: string, requestId?: number) {
  try {
    const [notification] = await db.insert(notifications)
      .values({
        userId,
        message,
        type,
        requestId,
      })
      .returning();
    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
}

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with original extension
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const ext = path.extname(file.originalname);
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9]/g, '_');
    cb(null, `${sanitizedName}-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Define allowed file types
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png'
  ];

  // Check file type
  if (!allowedTypes.includes(file.mimetype)) {
    cb(new Error('Invalid file type. Only PDF, Word, Excel, and image files are allowed.'));
    return;
  }

  // Check file size (10MB limit)
  const maxSize = 10 * 1024 * 1024; // 10MB in bytes
  if (file.size > maxSize) {
    cb(new Error('File too large. Maximum size is 10MB.'));
    return;
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

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // Fetch all requests with relations
  app.get("/api/requests", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      // First get the user's details including role
      const [user] = await db.select()
        .from(users)
        .where(eq(users.id, req.user!.id))
        .limit(1);

      // Query requests based on user role
      const requests = await db.query.purchaseRequests.findMany({
        where: user.role === 'admin'
          ? undefined
          : eq(purchaseRequests.requesterId, user.id),
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

      res.json(requests);
    } catch (error: any) {
      console.error("Error fetching requests:", error);
      res.status(500).send(error.message);
    }
  });

  // Handle file uploads and create request
  app.post("/api/requests", upload.array('files', 5), async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const requestData = JSON.parse(req.body.data);
      const files = req.files as Express.Multer.File[];

      // Generate request number
      const dateStr = format(new Date(), "yyyyMMdd");
      const requestNumber = `REQ/${dateStr}/${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

      // Create the request first
      const [request] = await db.insert(purchaseRequests)
        .values({
          ...requestData,
          requestNumber,
          requesterId: req.user!.id,
          status: requestData.status || "draft"
        })
        .returning();

      // Handle file attachments if any were uploaded
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
          // If file attachment fails, delete the uploaded files
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

      // Return the created request with its attachments
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
      // Clean up any uploaded files if request creation fails
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
      res.status(500).send(error.message);
    }
  });

  // Add download endpoint with proper security checks
  app.get("/api/attachments/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const [attachment] = await db.select()
        .from(fileAttachments)
        .where(eq(fileAttachments.id, parseInt(req.params.id)))
        .limit(1);

      if (!attachment) {
        return res.status(404).send("Attachment not found");
      }

      // Get the associated request to check permissions
      const [request] = await db.select()
        .from(purchaseRequests)
        .where(eq(purchaseRequests.id, attachment.requestId))
        .limit(1);

      if (!request) {
        return res.status(404).send("Associated request not found");
      }

      // Check if user has access to this request
      const [user] = await db.select()
        .from(users)
        .where(eq(users.id, req.user!.id))
        .limit(1);

      // Allow access if user is the requester, an admin, or from mandatory departments
      const mandatoryDepartments = ["CEO Office", "Director", "Finance"];
      const hasAccess = request.requesterId === user.id ||
                        user.role === 'admin' ||
                        mandatoryDepartments.includes(user.department);

      if (!hasAccess) {
        return res.status(403).send("Not authorized to access this file");
      }

      // Verify file exists
      if (!fs.existsSync(attachment.fileUrl)) {
        return res.status(404).send("File not found on server");
      }

      // Set Content-Type and Content-Disposition headers
      res.setHeader('Content-Type', attachment.fileType);
      res.setHeader('Content-Disposition', `attachment; filename="${attachment.fileName}"`);

      // Stream the file instead of loading it entirely into memory
      const fileStream = fs.createReadStream(attachment.fileUrl);
      fileStream.pipe(res);
    } catch (error: any) {
      console.error("Error downloading attachment:", error);
      res.status(500).send(error.message);
    }
  });

  // Notification routes
  app.get("/api/notifications", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
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
      res.status(500).send(error.message);
    }
  });

  app.put("/api/notifications/:id/read", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
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
        return res.status(404).send("Notification not found");
      }

      res.json(notification);
    } catch (error: any) {
      console.error("Error marking notification as read:", error);
      res.status(500).send(error.message);
    }
  });


  // Purchase request routes - adding notification creation
  app.put("/api/requests/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const [currentRequest] = await db
        .select()
        .from(purchaseRequests)
        .where(eq(purchaseRequests.id, parseInt(req.params.id)))
        .limit(1);

      if (!currentRequest) {
        return res.status(404).send("Request not found");
      }

      // Check authorization
      const userRole = req.user!.role;
      const userDepartment = req.user!.department;
      const isSpecialRole = ["CEO Office", "Director", "Finance"].includes(userDepartment);
      const isRequestOwner = currentRequest.requesterId === req.user!.id;

      // Allow admin to modify any request, others follow existing rules
      if (userRole !== "admin" && !isSpecialRole && !isRequestOwner) {
        return res.status(403).send("Not authorized to modify this request");
      }

      // Update request
      const [updatedRequest] = await db
        .update(purchaseRequests)
        .set({
          ...req.body,
          updatedAt: new Date(),
        })
        .where(eq(purchaseRequests.id, parseInt(req.params.id)))
        .returning();

      // Handle notifications based on status changes
      if (req.body.status && req.body.status !== currentRequest.status) {
        // Notify request owner
        await createNotification(
          currentRequest.requesterId,
          `Your purchase request ${currentRequest.requestNumber} has been ${req.body.status}`,
          'status_change',
          currentRequest.id
        );

        // Additional notifications based on status
        if (req.body.status === 'changes_requested') {
          await createNotification(
            currentRequest.requesterId,
            `Changes have been requested for your purchase request ${currentRequest.requestNumber}. Please review and update.`,
            'changes_requested',
            currentRequest.id
          );
        }
      }

      res.json(updatedRequest);
    } catch (error: any) {
      console.error("Error updating request:", error);
      res.status(500).send(error.message);
    }
  });

  app.delete("/api/requests/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      // Only admin can delete requests
      if (req.user!.role !== "admin") {
        return res.status(403).send("Only admin can delete requests");
      }

      // First, delete associated notifications
      await db
        .delete(notifications)
        .where(eq(notifications.requestId, parseInt(req.params.id)));

      // Then, delete associated approvals
      await db
        .delete(approvals)
        .where(eq(approvals.requestId, parseInt(req.params.id)));

      // Finally, delete the request itself
      const [deletedRequest] = await db
        .delete(purchaseRequests)
        .where(eq(purchaseRequests.id, parseInt(req.params.id)))
        .returning();

      if (!deletedRequest) {
        return res.status(404).send("Request not found");
      }

      res.json({ message: "Request deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting request:", error);
      res.status(500).send(error.message);
    }
  });

  // Approval routes
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

      // Get the request details
      const [request] = await db
        .select()
        .from(purchaseRequests)
        .where(eq(purchaseRequests.id, approval.requestId))
        .limit(1);

      if (request && req.body.status) {
        // Create notification for the request owner
        await createNotification(
          request.requesterId,
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

  // Sub-purposes routes
  app.get("/api/sub-purposes", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const purposeType = req.query.purposeType as string;
    try {
      const purposes = await db.select()
        .from(subPurposes)
        .where(purposeType ? eq(subPurposes.purposeType, purposeType) : undefined);

      res.json(purposes);
    } catch (error: any) {
      console.error("Error fetching sub-purposes:", error);
      res.status(500).send(error.message);
    }
  });

  app.post("/api/sub-purposes", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      // Parse and validate the request body
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

      // Insert the validated data
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

  // Add new endpoint to check sub-purpose usage
  app.get("/api/admin/sub-purposes/:id/check-usage", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    if (req.user!.role !== "admin") {
      return res.status(403).send("Only admin can check sub-purpose usage");
    }

    try {
      // Check if there are any purchase requests using this sub-purpose
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


  // Add priority analysis endpoint
  app.post("/api/requests/:id/analyze-priority", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const requestId = parseInt(req.params.id);
      const [request] = await db
        .select()
        .from(purchaseRequests)
        .where(eq(purchaseRequests.id, requestId))
        .limit(1);

      if (!request) {
        return res.status(404).send("Request not found");
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
      const [updatedRequest] = await db
        .update(purchaseRequests)
        .set({
          priority: priorityAnalysis.priority,
          priorityScore: priorityAnalysis.score,
          priorityReason: priorityAnalysis.reason,
          priorityRecommendations: priorityAnalysis.recommendations,
          updatedAt: new Date()
        })
        .where(eq(purchaseRequests.id, requestId))
        .returning();

      // Create notification for request owner
      await createNotification(
        request.requesterId,
        `Your purchase request ${request.requestNumber} has been analyzed. Priority: ${priorityAnalysis.priority.toUpperCase()}`,
        'priority_analysis',
        request.id
      );

      res.json(updatedRequest);
    } catch (error: any) {
      console.error("Error analyzing request priority:", error);
      res.status(500).send(error.message);
    }
  });

  // Add export endpoint
  app.get("/api/requests/export", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const exportFormat = req.query.format as string || 'xlsx';
      const dateStr = format(new Date(), "yyyyMMdd");

      // Get all requests with relations
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

      // Transform data for export
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
        'Created At': format(new Date(request.createdAt), 'PPpp'),
        'Updated At': format(new Date(request.updatedAt), 'PPpp'),
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
        // Default to XLSX
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Procurement Requests");

        // Fix column widths
        const maxWidth = Object.keys(exportData[0]).reduce((acc, key) => {
          return Math.max(acc, key.length);
        }, 10);
        worksheet["!cols"] = [{ wch: maxWidth }];

        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=procurement_report_${dateStr}.xlsx`);
        return res.send(buffer);
      }
    } catch (error: any) {
      console.error("Error exporting requests:", error);
      res.status(500).send(error.message);
    }
  });


  // Admin routes for managing sub-purposes
  app.post("/api/admin/sub-purposes", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    if (req.user!.role !== "admin") {
      return res.status(403).send("Only admin can manage sub-purposes");
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
      return res.status(401).send("Not authenticated");
    }

    if (req.user!.role !== "admin") {
      return res.status(403).send("Only admin can manage sub-purposes");
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

      const [updatedPurpose] = await db
        .update(subPurposes)
        .set(result.data)
        .where(eq(subPurposes.id, parseInt(req.params.id)))
        .returning();

      if (!updatedPurpose) {
        return res.status(404).send("Sub-purpose not found");
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

  // Update delete endpoint to handle foreign key constraint errors
  app.delete("/api/admin/sub-purposes/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    if (req.user!.role !== "admin") {
      return res.status(403).send("Only admin can manage sub-purposes");
    }

    try {
      // First check if sub-purpose is in use
      const [request] = await db
        .select()
        .from(purchaseRequests)
        .where(eq(purchaseRequests.subPurposeId, parseInt(req.params.id)))
        .limit(1);

      if (request) {
        return res.status(400).send(
          "This sub-purpose is currently being used by one or more purchase requests. Please freeze it instead of deleting."
        );
      }

      const [deletedPurpose] = await db
        .delete(subPurposes)
        .where(eq(subPurposes.id, parseInt(req.params.id)))
        .returning();

      if (!deletedPurpose) {
        return res.status(404).send("Sub-purpose not found");
      }

      res.json({ message: "Sub-purpose deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting sub-purpose:", error);

      // Handle foreign key constraint violation explicitly
      if (error.code === '23503') {
        return res.status(400).send(
          "Cannot delete this sub-purpose as it is referenced by existing purchase requests. Please freeze it instead."
        );
      }

      res.status(500).json({
        error: "Failed to delete sub-purpose",
        message: error.message
      });
    }
  });

  // Account request management routes
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

      // Hash the password before storing
      const hashedPassword = await hashPassword(result.data.password);

      const [request] = await db.insert(accountRequests)
        .values({
          ...result.data,
          password: hashedPassword,
          status: "pending"
        })
        .returning();

      // Notify admins about the new account request
      const admins = await db
        .select()
        .from(users)
        .where(eq(users.role, "admin"));

      for (const admin of admins) {
        await createNotification(
          admin.id,
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

  // Admin routes for managing account requests
  app.get("/api/admin/account-requests", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    if (req.user!.role !== "admin") {
      return res.status(403).send("Only admin can view account requests");
    }

    try {
      const requests = await db
        .select()
        .from(accountRequests)
        .orderBy(desc(accountRequests.createdAt));

      res.json(requests);
    } catch (error: any) {
      console.error("Errorfetching account requests:", error);
      res.status(500).json({
        error: "Failed to fetch account requests",
        message: error.message
      });
    }
  });

  app.post("/api/admin/account-requests/:id/approve", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    if (req.user!.role !== "admin") {
      return res.status(403).send("Only admin can approve account requests");
    }

    try {
      const [accountRequest] = await db
        .select()
        .from(accountRequests)
        .where(eq(accountRequests.id, parseInt(req.params.id)))
        .limit(1);

      if (!accountRequest) {
        return res.status(404).send("Account request not found");
      }


      // Create the user account
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

      // Update request status
      await db.update(accountRequests)
        .set({ status: "approved" })
        .where(eq(accountRequests.id, accountRequest.id));

      // Notify the user
      if (newUser) {
        await createNotification(
          newUser.id,
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
      return res.status(401).send("Not authenticated");
    }

    if (req.user!.role !== "admin") {
      return res.status(403).send("Only admin can manage account requests");
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
        return res.status(404).send("Account request not found");
      }

      // Notify the user about their account request status
      if (request.status === 'approved') {
        // Create the user account
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
            "Your account request has been approved. You can now log in.",
            "account_approved"
          );
        }
      } else if (request.status === 'rejected') {
        // Create a notification in the notifications table for future reference
        await createNotification(
          0, // System notification
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
      return res.status(401).send("Not authenticated");
    }

    if (req.user!.role !== "admin") {
      return res.status(403).send("Only admin can reject account requests");
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
        return res.status(404).send("Account request not found");
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

  // Admin routes for managing existing users
  app.get("/api/admin/users", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    if (req.user!.role !== "admin") {
      return res.status(403).send("Only admin can view all users");
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
      return res.status(401).send("Not authenticated");
    }

    if (req.user!.role !== "admin") {
      return res.status(403).send("Only admin can modify users");
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
        return res.status(404).send("User not found");
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
      return res.status(401).send("Not authenticated");
    }

    if (req.user!.role !== "admin") {
      return res.status(403).send("Only admin can delete users");
    }

    try {
      // Check if user exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, parseInt(req.params.id)))
        .limit(1);

      if (!existingUser) {
        return res.status(404).send("User not found");
      }

      // Delete related records first
      await db
        .delete(notifications)
        .where(eq(notifications.userId, parseInt(req.params.id)));

      await db
        .delete(approvals)
        .where(eq(approvals.approverId, parseInt(req.params.id)));

      // Delete the user
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

  // Add branding routes after the existing routes
  app.get("/api/branding", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const [branding] = await db
        .select()
        .from(companyBranding)
        .limit(1);

      res.json(branding || {});
    } catch (error: any) {
      console.error("Error fetching branding:", error);
      res.status(500).send(error.message);
    }
  });

  // Configure multer for logo upload
  const logoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(process.cwd(), 'uploads', 'logos');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
      cb(null, `logo-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
  });

  const logoUpload = multer({
    storage: logoStorage,
    limits: {
      fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/svg+xml'];
      if (!allowedTypes.includes(file.mimetype)) {
        cb(new Error('Invalid file type. Only JPEG, PNG and SVG files are allowed.'));
        return;
      }
      cb(null, true);
    }
  });

  app.post("/api/branding", logoUpload.single('logo'), async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    if (req.user!.role !== "admin") {
      return res.status(403).send("Only admin can update branding");
    }

    try {
      let logoData;
      let logoMimeType;

      if (req.file) {
        // Read file and convert to base64
        const fileData = await fs.promises.readFile(req.file.path);
        logoData = fileData.toString('base64');
        logoMimeType = req.file.mimetype;

        // Clean up uploaded file
        await fs.promises.unlink(req.file.path);
      }

      const brandingData = {
        ...req.body,
        logo: logoData,
        logoMimeType: logoMimeType
      };

      // Validate the input
      const result = insertCompanyBrandingSchema.safeParse(brandingData);
      if (!result.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: result.error.issues
        });
      }

      // Delete existing branding if any
      await db.delete(companyBranding);

      // Insert new branding
      const [newBranding] = await db
        .insert(companyBranding)
        .values(result.data)
        .returning();

      res.json(newBranding);
    } catch (error: any) {
      console.error("Error updating branding:", error);
      res.status(500).send(error.message);
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}