import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { db } from "@db";
import XLSX from 'xlsx';
import { Parser } from 'json2csv';
import {
  purchaseRequests,
  approvals,
  users,
  subPurposes,
  notifications,
  insertSubPurposeSchema
} from "@db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { format } from "date-fns";
import { analyzePurchaseRequestPriority } from "./utils/anthropic";

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

  // Check if user is not the requester
  if (request.requesterId === userId) return false;

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

      res.json(requests);
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
          subPurpose: true
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
  app.post("/api/requests", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const requestNumber = await generateRequestNumber(req.body.purposeType, req.body.subPurposeId);

      // Calculate total cost for priority analysis
      const itemsTotal = req.body.items.reduce(
        (sum, item) => sum + (Number(item.quantity) * Number(item.estimatedCost)),
        0
      );
      const totalEstimatedCost = itemsTotal + Number(req.body.freightAmount);

      // Perform priority analysis
      const priorityAnalysis = await analyzePurchaseRequestPriority({
        title: req.body.title,
        description: req.body.description,
        purpose: req.body.purpose,
        purposeType: req.body.purposeType,
        totalEstimatedCost,
        items: req.body.items.map(item => ({
          name: item.name,
          quantity: Number(item.quantity),
          estimatedCost: Number(item.estimatedCost)
        }))
      });

      const [request] = await db.insert(purchaseRequests)
        .values({
          ...req.body,
          requestNumber,
          requesterId: req.user!.id,
          status: req.body.status || "draft",
          priority: priorityAnalysis.priority,
          priorityScore: priorityAnalysis.score,
          priorityReason: priorityAnalysis.reason,
          priorityRecommendations: priorityAnalysis.recommendations
        })
        .returning();

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

      if (!isSpecialRole && !isRequestOwner && userRole !== "admin") {
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

  const httpServer = createServer(app);
  return httpServer;
}