import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { db } from "@db";
import XLSX from 'xlsx';
import { Parser } from 'json2csv';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  purchaseRequests,
  approvals,
  users,
  subPurposes,
  notifications,
  accountRequests,
  fileAttachments,
  insertSubPurposeSchema,
  insertAccountRequestSchema,
  insertUserSchema,
  insertFileAttachmentSchema
} from "@db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { format } from "date-fns";
import { analyzePurchaseRequestPriority } from "./utils/anthropic";
import * as crypto from 'crypto';

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
    // Generate unique filename
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow only specific file types
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, Word, Excel, and image files are allowed.'));
    }
  }
});

async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      resolve(derivedKey.toString('hex') + '.' + salt);
    });
  });
}

async function generateRequestNumber(purposeType: string, subPurposeId: number | undefined): Promise<string> {
  try {
    const now = new Date();
    const dateStr = format(now, "yyyyMMdd");
    const timeStr = format(now, "HHmmssSSS");

    let purposeCode = purposeType.substring(0, 3).toUpperCase();
    if (subPurposeId) {
      const [subPurpose] = await db.select()
        .from(subPurposes)
        .where(eq(subPurposes.id, subPurposeId))
        .limit(1);
      if (subPurpose) {
        purposeCode = subPurpose.name.substring(0, 3).toUpperCase();
      }
    }

    // Only select required fields for request number generation
    const existingRequests = await db.select({
      requestNumber: purchaseRequests.requestNumber,
      createdAt: purchaseRequests.createdAt
    })
      .from(purchaseRequests)
      .where(
        sql`DATE(${purchaseRequests.createdAt}) = CURRENT_DATE`
      )
      .orderBy(desc(purchaseRequests.createdAt));

    let sequenceNumber = 1;
    if (existingRequests.length > 0) {
      const lastRequest = existingRequests[0];
      const lastSequence = lastRequest.requestNumber.split('/')[2];
      if (lastSequence) {
        const match = lastSequence.match(/^\d+/);
        if (match) {
          sequenceNumber = parseInt(match[0]) + 1;
        }
      }
    }

    const requestNumber = `${purposeCode}/${dateStr}/${sequenceNumber.toString().padStart(3, '0')}-${timeStr}`;

    // Check for duplicate request numbers
    const [existing] = await db.select({
      requestNumber: purchaseRequests.requestNumber
    })
      .from(purchaseRequests)
      .where(eq(purchaseRequests.requestNumber, requestNumber))
      .limit(1);

    if (existing) {
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      return `${purposeCode}/${dateStr}/${sequenceNumber.toString().padStart(3, '0')}-${timeStr}-${random}`;
    }

    return requestNumber;
  } catch (error) {
    console.error("Error generating request number:", error);
    throw new Error("Failed to generate unique request number");
  }
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

async function canUserApprove(userId: number, requestId: number): Promise<boolean> {
  const [request] = await db
    .select()
    .from(purchaseRequests)
    .where(eq(purchaseRequests.id, requestId))
    .limit(1);

  if (!request) return false;

  // Get user's department
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return false;

  // Special roles (CEO Office, Director, Finance) can approve any request, including their own
  const isSpecialRole = ["CEO Office", "Director", "Finance"].includes(user.department);

  // For non-special roles, users cannot approve their own requests
  if (!isSpecialRole && request.requesterId === userId) {
    return false;
  }

  // Check if the request is pending
  if (request.status !== "pending") return false;

  // Check if this department hasn't approved yet
  const [existingApproval] = await db
    .select()
    .from(approvals)
    .where(
      and(
        eq(approvals.requestId, requestId),
        eq(approvals.department, user.department)
      )
    )
    .limit(1);

  // Can approve if no approval exists or if existing approval is pending
  return !existingApproval || existingApproval.status === "pending";
}

const mandatoryDepartments = ["CEO Office", "Director", "Finance"];

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // Fetch all requests with relations
  app.get("/api/requests", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      // Use a simpler query first without relations to debug
      const requests = await db.select()
        .from(purchaseRequests)
        .where(
          // Show all requests for admin, only user's requests for others
          req.user!.role === 'admin'
            ? undefined
            : eq(purchaseRequests.requesterId, req.user!.id)
        )
        .orderBy(desc(purchaseRequests.createdAt));

      // Then fetch related data separately
      const enrichedRequests = await Promise.all(requests.map(async (request) => {
        const [requester] = await db.select()
          .from(users)
          .where(eq(users.id, request.requesterId))
          .limit(1);

        const approvals = await db.select()
          .from(approvals)
          .where(eq(approvals.requestId, request.id));

        const [subPurpose] = request.subPurposeId
          ? await db.select()
            .from(subPurposes)
            .where(eq(subPurposes.id, request.subPurposeId))
            .limit(1)
          : [null];

        const attachments = await db.select()
          .from(fileAttachments)
          .where(eq(fileAttachments.requestId, request.id));

        return {
          ...request,
          requester,
          approvals: await Promise.all(
            approvals.map(async (approval) => {
              const [approver] = await db.select()
                .from(users)
                .where(eq(users.id, approval.approverId))
                .limit(1);
              return { ...approval, approver };
            })
          ),
          subPurpose,
          attachments
        };
      }));

      res.json(enrichedRequests);
    } catch (error: any) {
      console.error("Error fetching requests:", error);
      res.status(500).send(error.message);
    }
  });

  // Add this endpoint after the GET /api/requests endpoint
  app.get("/api/requests/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const request = await db.query.purchaseRequests.findFirst({
        where: eq(purchaseRequests.id, parseInt(req.params.id)),
        with: {
          requester: true,
          approvals: {
            with: {
              approver: true
            }
          },
          subPurpose: true,
          fileAttachments: true
        }
      });

      if (!request) {
        return res.status(404).send("Request not found");
      }

      res.json(request);
    } catch (error: any) {
      console.error("Error fetching request:", error);
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
  app.post("/api/requests", upload.array('files'), async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const requestData = JSON.parse(req.body.data);
      const files = req.files as Express.Multer.File[];

      const requestNumber = await generateRequestNumber(requestData.purposeType, requestData.subPurposeId);

      // Calculate total cost for priority analysis
      const itemsTotal = requestData.items.reduce(
        (sum, item) => sum + (Number(item.quantity) * Number(item.estimatedCost)),
        0
      );
      const totalEstimatedCost = itemsTotal + Number(requestData.freightAmount);

      // Perform priority analysis
      const priorityAnalysis = await analyzePurchaseRequestPriority({
        title: requestData.title,
        description: requestData.description,
        purpose: requestData.purpose,
        purposeType: requestData.purposeType,
        totalEstimatedCost,
        items: requestData.items.map(item => ({
          name: item.name,
          quantity: Number(item.quantity),
          estimatedCost: Number(item.estimatedCost)
        }))
      });

      // Create the purchase request
      const [request] = await db.insert(purchaseRequests)
        .values({
          ...requestData,
          requestNumber,
          requesterId: req.user!.id,
          status: requestData.status || "draft",
          priority: priorityAnalysis.priority,
          priorityScore: priorityAnalysis.score,
          priorityReason: priorityAnalysis.reason,
          priorityRecommendations: priorityAnalysis.recommendations
        })
        .returning();

      // Store file attachments if any
      if (files && files.length > 0) {
        const fileRecords = files.map(file => ({
          requestId: request.id,
          fileName: file.originalname,
          fileType: file.mimetype,
          fileSize: file.size,
          fileUrl: file.path,
        }));

        await db.insert(fileAttachments)
          .values(fileRecords);
      }

      // If request is submitted (not draft), create approvals and notify relevant approvers
      if (request.status === "pending") {
        // Get users from mandatory departments (CEO Office, Director, Finance)
        const mandatoryApprovers = await db
          .select()
          .from(users)
          .where(sql`${users.department} IN ('CEO Office', 'Director', 'Finance')`);

        // Create approval records and notifications for each mandatory approver
        for (const approver of mandatoryApprovers) {
          // Create approval record
          await db.insert(approvals).values({
            requestId: request.id,
            approverId: approver.id,
            department: approver.department,
            status: "pending",
            isMandatory: true,
          });

          // Create notification
          await createNotification(
            approver.id,
            `New purchase request ${request.requestNumber} requires your approval`,
            'new_request',
            request.id
          );
        }

        // Update the mandatory approvers count
        await db.update(purchaseRequests)
          .set({ mandatoryApproversCount: mandatoryApprovers.length })
          .where(eq(purchaseRequests.id, request.id));
      }

      res.json(request);
    } catch (error: any) {
      console.error("Error creating request:", error);
      res.status(500).send(error.message);
    }
  });

  // Handle request updates with notifications
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
        );      }

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
      console.error("Error fetching account requests:", error);
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
      // Get the account request
      const [request] = await db
        .select()
        .from(accountRequests)
        .where(eq(accountRequests.id, parseInt(req.params.id)))
        .limit(1);

      if (!request) {
        return res.status(404).send("Account request not found");
      }

      if (request.status !== "pending") {
        return res.status(400).send("Account request has already been processed");
      }

      // Create the user account
      const [newUser] = await db.insert(users)
        .values({
          username: request.username,
          password: request.password,
          email: request.email,
          contactNumber: request.contactNumber,
          department: request.department,
          role: request.role,
        })
        .returning();

      // Update the request status
      await db.update(accountRequests)
        .set({
          status: "approved",
          updatedAt: new Date()
        })
        .where(eq(accountRequests.id, request.id));

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
            'Your account request has been approved. You can now log in.',
            'account_approved'
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

  const httpServer = createServer(app);
  return httpServer;
}