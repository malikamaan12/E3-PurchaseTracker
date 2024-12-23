import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { db } from "@db";
import { 
  purchaseRequests, 
  approvals, 
  users, 
  subPurposes, 
  notifications 
} from "@db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { format } from "date-fns";

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

    const existingRequests = await db.select()
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

    const [existing] = await db.select()
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

export function registerRoutes(app: Express): Server {
  setupAuth(app);

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

  // Vendor routes
  app.get("/api/vendors", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const vendorList = await db.select().from(vendors);
      res.json(vendorList);
    } catch (error: any) {
      console.error("Error fetching vendors:", error);
      res.status(500).send(error.message);
    }
  });

  app.post("/api/vendors", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const vendor = await db.insert(vendors).values(req.body).returning();
      res.json(vendor[0]);
    } catch (error: any) {
      console.error("Error creating vendor:", error);
      res.status(500).send(error.message);
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
      const purpose = await db.insert(subPurposes)
        .values(req.body)
        .returning();

      res.json(purpose[0]);
    } catch (error: any) {
      console.error("Error creating sub-purpose:", error);
      res.status(500).send(error.message);
    }
  });

  // Purchase request routes
  app.post("/api/requests", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const requestNumber = await generateRequestNumber(req.body.purposeType, req.body.subPurposeId);
      console.log("Generated request number:", requestNumber);

      const request = await db.insert(purchaseRequests)
        .values({
          ...req.body,
          requestNumber,
          requesterId: req.user!.id,
          status: req.body.status || "draft",
        })
        .returning();

      res.json(request[0]);
    } catch (error: any) {
      console.error("Error creating request:", error);
      res.status(500).send(error.message);
    }
  });

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

      // Check if user has access to this request
      const userRole = req.user!.role;
      const userDepartment = req.user!.department;
      const isCEO = userDepartment === "CEO Office";
      const isRequestOwner = request.requesterId === req.user!.id;

      if (!isRequestOwner && !isCEO && !["admin", "approver"].includes(userRole)) {
        return res.status(403).send("Not authorized to view this request");
      }

      res.json(request);
    } catch (error: any) {
      console.error("Error fetching request:", error);
      res.status(500).send(error.message);
    }
  });

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

      const userRole = req.user!.role;
      const userDepartment = req.user!.department;
      const isCEO = userDepartment === "CEO Office";
      const isDirector = userDepartment === "Director";
      const isFinance = userDepartment === "Finance";
      const isRequestOwner = currentRequest.requesterId === req.user!.id;
      const isApprover = userRole === "approver" || ["CEO Office", "Director", "Finance"].includes(userDepartment);

      const canModify = 
        (isRequestOwner && ["draft", "changes_requested"].includes(currentRequest.status)) ||
        ((isCEO || isDirector || isFinance) && currentRequest.status === "pending") ||
        (isApprover && currentRequest.status === "pending") ||
        userRole === "admin";

      if (!canModify) {
        return res.status(403).send("Not authorized to modify this request");
      }

      let updateData = { ...req.body };

      if (!isFinance && 'isLocked' in updateData) {
        delete updateData.isLocked;
      }

      if (!isApprover && updateData.status && ["approved", "rejected"].includes(updateData.status)) {
        return res.status(403).send("Only approvers can approve or reject requests");
      }

      // Create notification if status is changing
      if (updateData.status && updateData.status !== currentRequest.status) {
        // Notify the request owner about the status change
        await createNotification(
          currentRequest.requesterId,
          `Your purchase request ${currentRequest.requestNumber} has been ${updateData.status}`,
          'status_change',
          currentRequest.id
        );

        // If status is changes_requested, also create a notification for the requester
        if (updateData.status === 'changes_requested') {
          await createNotification(
            currentRequest.requesterId,
            `Changes have been requested for your purchase request ${currentRequest.requestNumber}. Please review and update the request.`,
            'changes_requested',
            currentRequest.id
          );
        }

        // If status is approved, notify Finance department
        if (updateData.status === 'approved') {
          const financeUsers = await db
            .select()
            .from(users)
            .where(eq(users.department, 'Finance'));

          for (const user of financeUsers) {
            await createNotification(
              user.id,
              `Purchase request ${currentRequest.requestNumber} has been approved and requires financial processing.`,
              'finance_required',
              currentRequest.id
            );
          }
        }
      }

      const request = await db
        .update(purchaseRequests)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(purchaseRequests.id, parseInt(req.params.id)))
        .returning();

      res.json(request[0]);
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
      // Get the current request to verify ownership and status
      const [request] = await db
        .select()
        .from(purchaseRequests)
        .where(eq(purchaseRequests.id, parseInt(req.params.id)))
        .limit(1);

      if (!request) {
        return res.status(404).send("Request not found");
      }

      // Verify that the user owns this request and it's not approved
      if (request.requesterId !== req.user!.id) {
        return res.status(403).send("Not authorized to delete this request");
      }

      if (!["draft", "pending"].includes(request.status)) {
        return res.status(400).send("Cannot delete request in current status");
      }

      // Delete associated approvals first
      await db
        .delete(approvals)
        .where(eq(approvals.requestId, parseInt(req.params.id)));

      // Then delete the request
      const deleted = await db
        .delete(purchaseRequests)
        .where(eq(purchaseRequests.id, parseInt(req.params.id)))
        .returning();

      res.json(deleted[0]);
    } catch (error: any) {
      console.error("Error deleting request:", error);
      res.status(500).send(error.message);
    }
  });

  // Approval routes
  app.post("/api/approvals", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const approval = await db.insert(approvals).values({
        ...req.body,
        approverId: req.user!.id,
        department: req.user!.department
      }).returning();

      res.json(approval[0]);
    } catch (error: any) {
      console.error("Error creating approval:", error);
      res.status(500).send(error.message);
    }
  });

  app.put("/api/approvals/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const approval = await db
        .update(approvals)
        .set(req.body)
        .where(eq(approvals.id, parseInt(req.params.id)))
        .returning();

      res.json(approval[0]);
    } catch (error: any) {
      console.error("Error updating approval:", error);
      res.status(500).send(error.message);
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}