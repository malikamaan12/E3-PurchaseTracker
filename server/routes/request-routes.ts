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
  auditLogs
} from "@db/schema";
import { eq, and, desc, inArray, gte, lte, or, isNull, sql, sum, count } from "drizzle-orm";
import { AppError, ValidationError, DatabaseError } from "../utils/errors";
import { debug } from "../utils/debug";
import { notificationService } from "../services/NotificationService";
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

    const attachments = await db.select().from(fileAttachments).where(eq(fileAttachments.requestId, requestId));

    res.json({
      ...request,
      requester,
      vendor,
      subPurpose,
      approvals: requestApprovals,
      attachments
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
        priority: priority || "medium",
        requesterId: req.user!.id,
        items: items || [], 
        additionalApprovers: additionalApprovers || [], 
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

    // Handle date strings
    if (cleanData.createdAt) cleanData.createdAt = new Date(cleanData.createdAt);
    if (cleanData.updatedAt) cleanData.updatedAt = new Date(cleanData.updatedAt);

    const [updated] = await db
      .update(purchaseRequests)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(purchaseRequests.id, requestId))
      .returning();

    // Notification logic if transitioning to 'pending'
    // ARCHITECTURAL CONSTRAINT: Bypass if still in 'draft' status
    if (updateData.status === "pending" && (existing.status === "draft" || existing.status === "changes_requested")) {
      // 1. Define Mandatory Departments
      const mandatoryDepts = ["Finance", "CEO Office", "Director"];
      
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
          await db.insert(approvals).values({
            requestId,
            department: dept,
            status: "pending",
            isMandatory: mandatoryDepts.includes(dept),
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }

      // 4. Send Notifications to all potential approvers
      const approvers = await db
        .select()
        .from(users)
        .where(and(eq(users.role, "approver"), eq(users.isActive, true)));

      // Parse targets for notifications
      const targetUserIds = new Set<number>();
      
      // All general approvers
      approvers.forEach(a => targetUserIds.add(a.id));

      // Specific departmental approvers if any
      const deptApprovers = await db
        .select()
        .from(users)
        .where(and(
          inArray(users.department, allRequiredDepts),
          eq(users.isActive, true)
        ));
      deptApprovers.forEach(a => targetUserIds.add(a.id));

      await Promise.all(Array.from(targetUserIds).map(userId => 
        notificationService.createNotification({
          userId,
          title: "New Purchase Request",
          message: `A new purchase request "${updated.title}" requires your approval`,
          type: "approval_required",
          requestId: updated.id,
          priority: "high",
          actionType: "approve",
        })
      ));
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
    if (req.user!.role !== 'admin' && req.user!.role !== 'approver') {
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

// --- Approvals ---

router.post("/requests/:requestId/approvals", async (req, res, next) => {
  try {
    if (!req.isAuthenticated()) throw new AppError("Not authenticated", 401);

    const requestId = parseInt(req.params.requestId);
    const { status, comments } = req.body;

    const [approval] = await db
      .insert(approvals)
      .values({
        requestId,
        approverId: req.user!.id,
        status,
        comments,
        department: req.user!.department,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    res.status(201).json(approval);
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
