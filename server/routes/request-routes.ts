import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { db } from "@db";
import { 
  purchaseRequests, 
  approvals, 
  fileAttachments, 
  users, 
  vendors, 
  subPurposes, 
  notifications,
  errorLogs,
  purchaseApprovers,
  approvalAuditLogs,
  auditLogs,
  departments
} from "@db/schema";
import { eq, and, desc, inArray, gte, lte, or, isNull, sql, sum, count } from "drizzle-orm";
import { AppError, ValidationError, DatabaseError } from "../utils/errors";
import { debug } from "../utils/debug";
import { notificationService } from "../services/NotificationService";
import { requireAuth, requireApproverOrAdmin } from "../utils/middleware";
import multer from "multer";
import path from "path";
import fs from "fs";
import { isR2Configured, r2Storage } from "../services/R2StorageService";

const router = Router();

// Multer configuration for attachments
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = isR2Configured ? multer.memoryStorage() : multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${file.fieldname}-${uniqueSuffix}-${encodeURIComponent(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Helper for error analysis
async function analyzeError(error: Error, context: any) {
  return {
    timestamp: new Date().toISOString(),
    errorType: error.constructor.name,
    message: error.message,
    context,
  };
}

// --- Shared Entities ---
router.get("/requests/sub-purposes", async (req, res, next) => {
  try {
    if (!req.isAuthenticated()) throw new AppError("Not authenticated", 401);
    const purposeType = req.query.purposeType as string;
    
    const conditions = [eq(subPurposes.is_frozen, false)];
    if (purposeType) {
      conditions.push(eq(subPurposes.purpose_type, purposeType));
    }

    const activeSubPurposes = await db
      .select({
        id: subPurposes.id,
        name: subPurposes.name,
        purpose_type: subPurposes.purpose_type
      })
      .from(subPurposes)
      .where(and(...conditions))
      .orderBy(desc(subPurposes.created_at));

    res.json(activeSubPurposes);
  } catch (error) {
    debug(req, "Error fetching sub-purposes:", error);
    next(error);
  }
});

// --- Analytics Endpoints ---

// Optimized Spend Analytics for Vercel Serverless
router.get("/requests/analytics", async (req, res, next) => {
  try {
    if (!req.isAuthenticated()) throw new AppError("Not authenticated", 401);

    debug(req, "Fetching spend analytics...");
    
    // Execute a single grouped aggregation to prevent multiple round-trips
    const stats = await db
      .select({
        status: purchaseRequests.status,
        count: count(),
        totalSpend: sum(purchaseRequests.totalEstimatedCost)
      })
      .from(purchaseRequests)
      .groupBy(purchaseRequests.status);

    const formattedStats = stats.reduce((acc: any, curr: any) => {
      acc[curr.status] = {
        count: Number(curr.count) || 0,
        total: Number(curr.totalSpend) || 0
      };
      return acc;
    }, {});

    res.json(formattedStats);
  } catch (error) {
    debug(req, "Error in /api/requests/analytics:", error);
    next(error);
  }
});

// --- Request Endpoints ---

// List requests with comprehensive filters
router.get("/requests", async (req, res, next) => {
  try {
    if (!req.isAuthenticated()) throw new AppError("Not authenticated", 401);

    debug(req, "Fetching requests with filters:", req.query);
    const whereConditions = [];

    // Status filter
    if (req.query.status) {
      const statuses = (req.query.status as string).split(",");
      whereConditions.push(inArray(purchaseRequests.status, statuses));
    }

    // Department filter
    if (req.query.department) {
      whereConditions.push(eq(users.department, req.query.department as string));
    }

    // Vendor filter
    if (req.query.vendor) {
      whereConditions.push(eq(purchaseRequests.vendorId, parseInt(req.query.vendor as string)));
    }

    // Purpose filter
    if (req.query.purpose) {
      whereConditions.push(eq(purchaseRequests.purposeType, req.query.purpose as string));
    }

    // Sub-purpose filter
    if (req.query.subPurpose) {
      whereConditions.push(eq(purchaseRequests.subPurposeId, parseInt(req.query.subPurpose as string)));
    }

    // Date range filters
    if (req.query.dateFrom) {
      whereConditions.push(gte(purchaseRequests.createdAt, new Date(req.query.dateFrom as string)));
    }
    if (req.query.dateTo) {
      whereConditions.push(lte(purchaseRequests.createdAt, new Date(req.query.dateTo as string)));
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PHASE 4: DEPARTMENT-SCOPED DASHBOARD
    // - admin: sees all requests
    // - isApprover: sees all requests from depts in their approval queue
    // - user: sees all requests created by anyone in their own department
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const currentUser = req.user!;
    const userIsAdmin = currentUser.role === 'admin';
    const userIsApprover = (currentUser as any).isApprover === true;

    if (!userIsAdmin && !userIsApprover) {
      // Regular users see all requests from THEIR DEPARTMENT (not just their own)
      whereConditions.push(eq(users.department, currentUser.department));
    }
    // Approvers and admins see all requests (no additional filter needed)

    const requests = await db
      .select({
        id: purchaseRequests.id,
        requestNumber: purchaseRequests.requestNumber,
        title: purchaseRequests.title,
        status: purchaseRequests.status,
        totalEstimatedCost: purchaseRequests.totalEstimatedCost,
        createdAt: purchaseRequests.createdAt,
        updatedAt: purchaseRequests.updatedAt,
        purposeType: purchaseRequests.purposeType,
        priority: purchaseRequests.priority,
        isLocked: purchaseRequests.isLocked,
        requester: {
          id: users.id,
          username: users.username,
          department: users.department,
          role: users.role,
        },
      })
      .from(purchaseRequests)
      .innerJoin(users, eq(users.id, purchaseRequests.requesterId))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(purchaseRequests.createdAt));

    res.json(requests);
  } catch (error) {
    debug(req, "Error in /api/requests:", error);
    next(error);
  }
});

// Get single request detail with all relations
router.get("/requests/:id", async (req, res, next) => {
  try {
    if (!req.isAuthenticated()) throw new AppError("Not authenticated", 401);

    const requestId = parseInt(req.params.id);
    if (isNaN(requestId)) throw new ValidationError("Invalid request ID");

    debug(req, "Fetching request details:", requestId);

    const [request] = await db
      .select()
      .from(purchaseRequests)
      .where(eq(purchaseRequests.id, requestId))
      .limit(1);

    if (!request) throw new AppError("Request not found", 404);

    // Fetch all related data
    const [requester] = await db.select().from(users).where(eq(users.id, request.requesterId)).limit(1);
    const [vendor] = await db.select().from(vendors).where(eq(vendors.id, request.vendorId)).limit(1);
    const [subPurpose] = request.subPurposeId 
      ? await db.select().from(subPurposes).where(eq(subPurposes.id, request.subPurposeId)).limit(1)
      : [null];

    const requestApprovals = await db
      .select({
        id: approvals.id,
        status: approvals.status,
        comments: approvals.comments,
        department: approvals.department,
        createdAt: approvals.createdAt,
        approver: {
          id: users.id,
          username: users.username,
        }
      })
      .from(approvals)
      .leftJoin(users, eq(users.id, approvals.approverId))
      .where(eq(approvals.requestId, requestId));

    // Fetch all Potential Stakeholders for these departments
    const depts = [...new Set(requestApprovals.map(a => a.department))];
    const deptStakeholders = depts.length > 0 
      ? await db
          .select({
            id: users.id,
            username: users.username,
            department: users.department,
          })
          .from(users)
          .where(
            and(
              inArray(users.department, depts),
              eq(users.role, 'approver')
            )
          )
      : [];

    // Map stakeholders to each approval step
    const approvalsWithStakeholders = requestApprovals.map(approval => ({
      ...approval,
      stakeholders: deptStakeholders.filter(s => s.department === approval.department)
    }));

    const attachments = await db.select().from(fileAttachments).where(eq(fileAttachments.requestId, requestId));

    let parsedItems = request.items || [];
    try {
      if (typeof request.items === "string") parsedItems = JSON.parse(request.items);
    } catch(e) {}

    let parsedApprovers = request.additionalApprovers || [];
    try {
      if (typeof request.additionalApprovers === "string") parsedApprovers = JSON.parse(request.additionalApprovers);
    } catch(e) {}

    // Fetch Audit Logs for the Request Timeline
    const requestAuditLogs = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        timestamp: auditLogs.timestamp,
        details: auditLogs.details,
        user: {
          username: users.username,
        }
      })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.userId))
      .where(
        and(
          eq(auditLogs.resourceId, requestId),
          eq(auditLogs.resourceType, "purchase_request")
        )
      )
      .orderBy(desc(auditLogs.timestamp));

    res.json({
      ...request,
      items: parsedItems,
      additionalApprovers: parsedApprovers,
      requester,
      vendor,
      subPurpose,
      approvals: approvalsWithStakeholders,
      attachments,
      auditLogs: requestAuditLogs
    });
  } catch (error) {
    debug(req, "Error in /api/requests/:id:", error);
    next(error);
  }
});

// Create new purchase request
router.post("/requests", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.isAuthenticated()) throw new AppError("Not authenticated", 401);

    const { 
      title, 
      description, 
      totalEstimatedCost, 
      vendorId, 
      purposeType, 
      priority,
      currency,
      freightAmount,
      subPurposeId,
      items,
      additionalApprovers,
      attachmentIds
    } = req.body;
    
    // Generate unique request number (PR-2026-XXXX)
    const year = new Date().getFullYear();
    const countResult = await db.select({ count: count() }).from(purchaseRequests);
    const nextNum = (Number(countResult[0]?.count) || 0) + 1;
    const requestNumber = `PR-${year}-${nextNum.toString().padStart(4, '0')}`;

    // 1. Insert the request
    const [newRequest] = await db
      .insert(purchaseRequests)
      .values({
        requestNumber,
        title: title || "Untitled Request",
        description: description || "",
        totalEstimatedCost: parseInt(totalEstimatedCost) || 0,
        vendorId: parseInt(vendorId),
        purposeType: purposeType || "General",
        subPurposeId: subPurposeId ? parseInt(subPurposeId) : null,
        priority: priority || "medium",
        currency: currency || "QAR",
        freightAmount: parseInt(freightAmount) || 0,
        requesterId: req.user!.id,
        items: JSON.stringify(items || []) as any, 
        additionalApprovers: JSON.stringify(additionalApprovers || []) as any, 
        status: "draft",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // 2. Link attachments if provided
    if (attachmentIds && Array.isArray(attachmentIds) && attachmentIds.length > 0) {
      await db.update(fileAttachments)
        .set({ requestId: newRequest.id })
        .where(inArray(fileAttachments.id, attachmentIds));
    }

    debug(req, "Ultimate Request created successfully:", newRequest.id);
    res.status(201).json(newRequest);
  } catch (error) {
    debug(req, "Error creating ultimate request:", error);
    next(error);
  }
});


// Update/Submit request with notification logic
router.put("/requests/:id", async (req, res, next) => {
  try {
    if (!req.isAuthenticated()) throw new AppError("Not authenticated", 401);

    const requestId = parseInt(req.params.id);
    const updateData = req.body;

    const [existing] = await db
      .select()
      .from(purchaseRequests)
      .where(eq(purchaseRequests.id, requestId))
      .limit(1);

    if (!existing) throw new AppError("Request not found", 404);
    
    // Check ownership if not admin/approver
    if (existing.requesterId !== req.user!.id && req.user!.role === 'user') {
      throw new AppError("Unauthorized access", 403);
    }

    if (existing.isLocked && updateData.status !== "changes_requested") {
      throw new AppError("Request is locked for editing", 403);
    }

    // Clean up update data to match schema
    const { requester, vendor, subPurpose, approvals: _a, attachments: _att, ...cleanData } = updateData;

    // Handle array primitives converting to DB text columns
    if (cleanData.items && Array.isArray(cleanData.items)) {
      cleanData.items = JSON.stringify(cleanData.items) as any;
    }
    if (cleanData.additionalApprovers && Array.isArray(cleanData.additionalApprovers)) {
      cleanData.additionalApprovers = JSON.stringify(cleanData.additionalApprovers) as any;
    }

    // Handle date strings
    if (cleanData.createdAt) cleanData.createdAt = new Date(cleanData.createdAt);
    if (cleanData.updatedAt) cleanData.updatedAt = new Date(cleanData.updatedAt);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PHASE 3: APPROVAL RESET ON EDIT
    // If user is editing a request that had "changes_requested",
    // delete all existing approval records and re-flag for re-review.
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const isEditAfterChangesRequested =
      existing.status === "changes_requested" &&
      updateData.status !== "changes_requested" &&
      existing.requesterId === req.user!.id;

    if (isEditAfterChangesRequested) {
      debug(req, "[Approval Reset] Resetting approvals after requester edited.");
      
      // Delete all approval records for this request
      const { approvals: approvalsTable } = await import("@db/schema");
      await db.delete(approvalsTable).where(eq(approvalsTable.requestId, requestId));

      // Force status back to draft so user can re-submit
      cleanData.status = "draft";
      cleanData.isLocked = false;
    }

    const [updated] = await db
      .update(purchaseRequests)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(purchaseRequests.id, requestId))
      .returning();

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Notification logic if transitioning to 'pending'
    // ARCHITECTURAL CONSTRAINT: Bypass if still in 'draft' status
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (updateData.status === "pending" && (existing.status === "draft" || existing.status === "changes_requested")) {
      // 1. Fetch Mandatory Departments from DB
      const mandatoryDeptRecords = await db.select().from(departments).where(eq(departments.isApprover, true));
      const mandatoryDepts = mandatoryDeptRecords.map(d => d.name);
      
      // 2. Combine with Additional Approvers from the request
      let additionalDepts: string[] = [];
      try {
        if (typeof updated.additionalApprovers === 'string') {
          additionalDepts = JSON.parse(updated.additionalApprovers);
        } else if (Array.isArray(updated.additionalApprovers)) {
          additionalDepts = updated.additionalApprovers;
        }
      } catch (e) {
        debug(req, "Error parsing additional approvers:", e);
      }

      const allRequiredDepts = Array.from(new Set([...mandatoryDepts, ...additionalDepts]));

      // 3. Create Approval Records for each department if they don't exist
      for (const dept of allRequiredDepts) {
        const [existingApproval] = await db
          .select()
          .from(approvals)
          .where(and(
            eq(approvals.requestId, requestId),
            eq(approvals.department, dept)
          ))
          .limit(1);

        if (!existingApproval) {
          // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          // PHASE 2: HOD AUTO-APPROVAL
          // If the requester is an approver and this dept is their own dept,
          // automatically mark it as approved.
          // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          const requesterIsApproverForThisDept =
            req.user!.department === dept && (req.user as any).isApprover === true;

          const [newApproval] = await db.insert(approvals).values({
            requestId,
            approverId: requesterIsApproverForThisDept ? req.user!.id : null,
            department: dept,
            status: requesterIsApproverForThisDept ? "approved" : "pending",
            isMandatory: mandatoryDepts.includes(dept),
            comments: requesterIsApproverForThisDept ? "Auto-approved: Request submitted by department HOD/GM" : null,
            processedAt: requesterIsApproverForThisDept ? new Date() : null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }).returning();

          if (requesterIsApproverForThisDept) {
            debug(req, `[HOD Auto-Approval] Dept ${dept} auto-approved by HOD ${req.user!.username}`);
            
            // Add to Audit Logs for transparency
            await db.insert(auditLogs).values({
              resourceId: requestId,
              resourceType: "purchase_request",
              action: "department_auto_approved",
              userId: req.user!.id,
              details: { 
                department: dept, 
                reason: "Requester is Department Head/Approver",
                approvalId: newApproval.id 
              },
              timestamp: new Date(),
            });
          }
        }
      }

      // 4. Send Notifications to all potential approvers in required departments
      const deptApprovers = await db
        .select()
        .from(users)
        .where(and(
          inArray(users.department, allRequiredDepts),
          eq(users.isActive, true)
        ));
      
      // Also include all admin users
      const adminUsers = await db.select().from(users).where(and(eq(users.role, 'admin'), eq(users.isActive, true)));

      const targetUserIds = new Set<number>();
      deptApprovers.forEach(a => targetUserIds.add(a.id));
      adminUsers.forEach(a => targetUserIds.add(a.id));
      // Don't notify the requester themselves
      targetUserIds.delete(req.user!.id);

      await Promise.all(Array.from(targetUserIds).map(userId => 
        notificationService.createNotification({
          userId,
          title: "New Purchase Request Pending",
          message: `"${updated.title}" requires your approval`,
          type: "approval_required",
          requestId: updated.id,
          priority: "high",
          actionType: "approve",
        })
      ));

      // Lock the request during approval process
      await db.update(purchaseRequests)
        .set({ isLocked: true, updatedAt: new Date() })
        .where(eq(purchaseRequests.id, requestId));
    }

    res.json(updated);
  } catch (error) {
    debug(req, "Error updating request:", error);
    
    if (!(error instanceof ValidationError)) {
      const analysis = await analyzeError(error as Error, {
        requestId: req.params.id,
        userId: req.user?.id,
        path: req.path,
      });

      await db.insert(errorLogs).values({
        message: error instanceof Error ? error.message : "Unknown error",
        severity: "error",
        userId: req.user?.id,
        path: req.path,
        aiAnalysis: analysis,
        createdAt: new Date(),
      } as any);
    }
    next(error);
  }
});

// Bulk Approval Endpoint (Optimized for Power Users)
router.post("/requests/bulk-approve", async (req, res, next) => {
  try {
    if (!req.isAuthenticated()) throw new AppError("Not authenticated", 401);
    // Approver department OR admin can bulk-approve
    const isApprover = (req.user as any).isApprover === true;
    if (req.user!.role !== 'admin' && !isApprover) {
      throw new AppError("Unauthorized for bulk actions", 403);
    }

    const { requestIds, comments } = req.body;
    if (!Array.isArray(requestIds) || requestIds.length === 0) {
      throw new ValidationError("No request IDs provided");
    }

    debug(req, "Processing bulk approval for IDs:", requestIds);

    // BATCHED TRANSACTION: Prevents un-batched database writes and timeouts
    await db.transaction(async (tx: any) => {
      // 1. Update purchase request statuses
      await tx
        .update(purchaseRequests)
        .set({ status: "approved", updatedAt: new Date() })
        .where(and(
          inArray(purchaseRequests.id, requestIds),
          eq(purchaseRequests.status, "pending")
        ));

      // 2. Insert approval records with deduplication logic
      const approvalEntries = requestIds.map(id => ({
        requestId: id,
        approverId: req.user!.id,
        status: "approved",
        comments: comments || "Bulk approved by administrator",
        department: req.user!.department,
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      // Using onConflictDoUpdate for deduplication if unique index exists
      // If not, we'd traditionally check existing, but for performance we batch insert
      await tx.insert(approvals).values(approvalEntries).onConflictDoNothing();
    });

    res.json({ success: true, message: `Successfully processed ${requestIds.length} requests.` });
  } catch (error) {
    debug(req, "Error in bulk approval:", error);
    next(error);
  }
});

// --- Approvals: Full State Machine ---

router.post("/requests/:requestId/approvals", async (req, res, next) => {
  try {
    if (!req.isAuthenticated()) throw new AppError("Not authenticated", 401);

    const requestId = parseInt(req.params.requestId);
    const { status, comments } = req.body;
    const actingUser = req.user!;

    if (!["approved", "rejected", "changes_requested"].includes(status)) {
      throw new ValidationError("Invalid approval status. Must be 'approved', 'rejected', or 'changes_requested'.");
    }

    // 1. Fetch the parent request
    const [request] = await db
      .select()
      .from(purchaseRequests)
      .where(eq(purchaseRequests.id, requestId))
      .limit(1);

    if (!request) throw new AppError("Request not found", 404);
    if (request.status !== "pending") {
      throw new AppError(`Cannot act on a request with status: "${request.status}"`, 400);
    }

    // 2. Check if this user's department has a pending approval record
    const [deptApproval] = await db
      .select()
      .from(approvals)
      .where(and(
        eq(approvals.requestId, requestId),
        eq(approvals.department, actingUser.department)
      ))
      .limit(1);

    // Allow admin to approve even without a dept record
    const isAdmin = actingUser.role === 'admin';
    const isApprover = (actingUser as any).isApprover === true;

    if (!deptApproval && !isAdmin) {
      throw new AppError("Your department is not in the approval chain for this request.", 403);
    }
    if (deptApproval?.status === "approved" && !isAdmin) {
      throw new AppError("Your department has already approved this request.", 400);
    }

    // 3. Update the existing approval record
    let updatedApproval;
    if (deptApproval) {
      const [result] = await db
        .update(approvals)
        .set({
          approverId: actingUser.id,
          status,
          comments: comments || null,
          processedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(approvals.id, deptApproval.id))
        .returning();
      updatedApproval = result;

      // 4. Write audit log
      await db.insert(approvalAuditLogs).values({
        approvalId: deptApproval.id,
        userId: actingUser.id,
        action: status,
        previousStatus: deptApproval.status,
        newStatus: status,
        comments: comments || null,
        metadata: {
          department: actingUser.department,
          ipAddress: req.ip,
        },
        createdAt: new Date(),
      });
    }

    // 5. Cascade Logic: Check all approvals to determine next request state
    const allApprovals = await db
      .select()
      .from(approvals)
      .where(eq(approvals.requestId, requestId));

    let newRequestStatus: string | null = null;
    let notifTitle = "";
    let notifMessage = "";

    if (status === "rejected") {
      // Any rejection immediately rejects the whole request
      newRequestStatus = "rejected";
      notifTitle = "Purchase Request Rejected";
      notifMessage = `"${request.title}" was rejected by ${actingUser.username} (${actingUser.department})${comments ? `: "${comments}"` : ""}`;
    } else if (status === "changes_requested") {
      // Any changes_requested puts the request back to the requester
      newRequestStatus = "changes_requested";
      notifTitle = "Changes Requested on Your Purchase Request";
      notifMessage = `${actingUser.username} (${actingUser.department}) has requested changes on "${request.title}"${comments ? `: "${comments}"` : ""}`;
    } else if (status === "approved") {
      // Check if ALL approval records are now approved
      const pendingOrRejected = allApprovals.filter(a => a.status !== "approved");
      if (pendingOrRejected.length === 0) {
        newRequestStatus = "approved";
        notifTitle = "Purchase Request Fully Approved! 🎉";
        notifMessage = `"${request.title}" has been approved by all required departments.`;
      }
      // Otherwise do nothing — more approvals still needed
    }

    // 6. Update request status if needed
    if (newRequestStatus) {
      await db
        .update(purchaseRequests)
        .set({
          status: newRequestStatus,
          isLocked: newRequestStatus === "approved" ? true : false, // Released for editing if changes_requested
          updatedAt: new Date(),
        })
        .where(eq(purchaseRequests.id, requestId));

      // 7. Send notification to the original requester
      await notificationService.createNotification({
        userId: request.requesterId,
        title: notifTitle,
        message: notifMessage,
        type: newRequestStatus === "approved" ? "approval_complete" : newRequestStatus === "rejected" ? "rejection" : "changes_requested",
        requestId,
        priority: newRequestStatus === "rejected" ? "high" : "normal",
      });
    }

    res.status(200).json({
      approval: updatedApproval,
      requestStatus: newRequestStatus || request.status,
      message: status === "approved" && !newRequestStatus
        ? "Approved. Waiting for remaining department sign-offs."
        : `Request has been ${status.replace("_", " ")}.`
    });
  } catch (error) {
    next(error);
  }
});


// --- Attachments ---

router.post("/attachments", upload.array("files", 5), async (req, res, next) => {
  try {
    if (!req.isAuthenticated()) throw new AppError("Not authenticated", 401);
    if (!req.files || !Array.isArray(req.files)) throw new AppError("No files uploaded", 400);

    const results = await Promise.all(req.files.map(async (file) => {
      let fileUrl = "";
      if (isR2Configured) {
        const objectKey = await r2Storage.uploadAttachment(file.buffer, file.originalname, file.mimetype);
        fileUrl = `r2://${objectKey}`;
      } else {
        fileUrl = `/uploads/${file.filename}`;
      }
      
      return {
        fileName: file.originalname,
        fileType: file.mimetype,
        fileSize: file.size,
        fileUrl,
      };
    }));

    res.status(201).json(results);
  } catch (error) {
    next(error);
  }
});

router.get("/attachments/:id", async (req, res, next) => {
  try {
    if (!req.isAuthenticated()) throw new AppError("Not authenticated", 401);
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new ValidationError("Invalid ID");

    const [att] = await db.select().from(fileAttachments).where(eq(fileAttachments.id, id)).limit(1);
    if (!att) throw new AppError("Attachment not found", 404);
    
    if (att.fileUrl.startsWith('r2://')) {
      const objectKey = att.fileUrl.replace('r2://', '');
      const signedUrl = await r2Storage.getReadPresignedUrl(objectKey);
      return res.redirect(signedUrl);
    }

    const filePath = path.join(process.cwd(), att.fileUrl);
    res.sendFile(filePath);
  } catch (error) {
    next(error);
  }
});

// --- Approvers List ---

router.get("/approvers", async (req, res, next) => {
  try {
    if (!req.isAuthenticated()) throw new AppError("Not authenticated", 401);
    const { department } = req.query;

    const whereConditions = [eq(users.isActive, true)];
    if (department) {
      whereConditions.push(eq(purchaseApprovers.departmentId, department as string));
    }

    const approvers = await db
      .select({
        id: purchaseApprovers.id,
        departmentId: purchaseApprovers.departmentId,
        approverId: purchaseApprovers.approverId,
        isMandatory: purchaseApprovers.isMandatory,
        level: purchaseApprovers.level,
        approver: {
          id: users.id,
          username: users.username,
          email: users.email,
          department: users.department,
        },
      })
      .from(purchaseApprovers)
      .innerJoin(users, eq(users.id, purchaseApprovers.approverId))
      .where(and(...whereConditions))
      .orderBy(purchaseApprovers.level);
    res.json(approvers);
  } catch (error) {
    debug(req, "Error fetching approvers:", error);
    next(new DatabaseError("Failed to fetch approvers"));
  }
});

export default router;
