import { NextRequest, NextResponse } from "next/server";
import { AppError } from "@/lib/utils/errors";
import { db } from "@db";
import { safeParseItems } from "@/lib/utils/safe-parse";
import { 
  purchaseRequests, 
  users, 
  vendors, 
  subPurposes, 
  approvals, 
  fileAttachments, 
  auditLogs,
  approvalAuditLogs,
  departments,
  paymentInstallments
} from "@db/schema";
import { eq, and, or, inArray, desc, count, asc } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { normalizeDepartmentAssignments } from "@/lib/auth-shared";
import { updateRequestSchema } from "@/lib/validation";
import { notificationService } from "@/lib/services/NotificationService";
import { evaluateCompliance, capturePrComplianceSnapshot } from "@/lib/core/compliance";
import { seedInitialApprovals } from "@/lib/core/workflow";
import { getExchangeRateToQAR } from "@/lib/utils/currency";
import { ComplianceOverrideService } from "@/lib/services/ComplianceOverrideService";

export const dynamic = 'force-dynamic';

// GET /api/requests/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: paramId } = await params;
  const requestId = parseInt(paramId);
  let authenticatedUser: any = null;

  try {
    authenticatedUser = await getAuthenticatedUser(req);
    if (!authenticatedUser) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    if (isNaN(requestId)) return NextResponse.json({ error: "Invalid request ID" }, { status: 400 });

    const [request] = await db
      .select()
      .from(purchaseRequests)
      .where(eq(purchaseRequests.id, requestId))
      .limit(1);

    if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });

    // Fetch related data in parallel for better performance
    // Implement 8s safety timeout for the parallel fetch
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Database synchronization timeout")), 8000)
    );

    const dataFetchPromise = Promise.all([
      db.select().from(users).where(eq(users.id, request.requesterId)).limit(1),
      request.vendorId
        ? db.select().from(vendors).where(eq(vendors.id, request.vendorId)).limit(1)
        : Promise.resolve([null]),
      request.subPurposeId 
        ? db.select().from(subPurposes).where(eq(subPurposes.id, request.subPurposeId)).limit(1)
        : Promise.resolve([null]),
      db.select({
        id: approvals.id,
        status: approvals.status,
        comments: approvals.comments,
        department: approvals.department,
        createdAt: approvals.createdAt,
        processedAt: approvals.processedAt,
        isMandatory: approvals.isMandatory,
        approver: {
          id: users.id,
          username: users.username,
        }
      })
      .from(approvals)
      .leftJoin(users, eq(users.id, approvals.approverId))
      .where(eq(approvals.requestId, requestId))
      .orderBy(asc(approvals.id)),
      db.select().from(fileAttachments).where(eq(fileAttachments.requestId, requestId)),
      db.select().from(paymentInstallments).where(eq(paymentInstallments.requestId, requestId)),
      db.select({
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
          or(
            eq(auditLogs.resourceType, "purchase_request"),
            eq(auditLogs.resourceType, "purchase_requests")
          )
        )
      )
      .orderBy(desc(auditLogs.timestamp))
    ]);

    dataFetchPromise.catch(() => {}); // Prevent unhandled promise rejection if query fails after timeout
    const [
      [requester],
      [vendor],
      [subPurpose],
      requestApprovals,
      attachments,
      installments,
      requestAuditLogs
    ] = await Promise.race([dataFetchPromise, timeoutPromise]) as any;

    // ── STAGE 1 VISIBILITY GUARD ──────────────────────────────────────────────
    // If request is pending_dept_head, only the requester, their submitting department members, or super_admin may access it.
    const isSuperAdmin = authenticatedUser.role === 'super_admin';
    const isAdmin = authenticatedUser.role === 'admin' || isSuperAdmin;
    const isRequester = request.requesterId === authenticatedUser.id;
    const effectiveRequestDept = (request.department || requester?.department || '').toLowerCase().trim();
    const userDepts = (authenticatedUser.departments || [authenticatedUser.department])
      .filter(Boolean)
      .map((d: any) => (typeof d === 'string' ? d : d.department || '').toLowerCase().trim());
    const isDeptMember = userDepts.includes(effectiveRequestDept);

    if (request.status === 'pending_dept_head') {
      if (!isSuperAdmin && !isRequester && !isDeptMember) {
        return NextResponse.json(
          { 
            error: "Access Denied", 
            message: "This request is pending Stage 1 Department Head sign-off and is not yet available for mandatory review." 
          }, 
          { status: 403 }
        );
      }
    }

    // ── GENERAL RBAC VISIBILITY GUARD ─────────────────────────────────────────
    // Non-admins can only access requests if they are the requester, a member of the submitting department,
    // or an authorized approver for one of the request's approval steps.
    if (!isAdmin && !isRequester && !isDeptMember) {
      const approverDepts: string[] = [];
      if (authenticatedUser.role === 'approver' && authenticatedUser.department) {
        approverDepts.push(authenticatedUser.department.toLowerCase().trim());
      }
      const normalizedAssignments = authenticatedUser.departmentAssignments || normalizeDepartmentAssignments(authenticatedUser.assignedDepartments, authenticatedUser.department);
      for (const assignment of normalizedAssignments) {
        if (assignment.status === 'active' && (assignment.role === 'approver' || assignment.role === 'both')) {
          if (assignment.department) {
            approverDepts.push(assignment.department.toLowerCase().trim());
          }
        }
      }

      const safeApprovalsList = Array.isArray(requestApprovals) ? requestApprovals : [];
      const hasApproverAuthority = safeApprovalsList.some((app: any) => 
        app.department && approverDepts.includes(app.department.toLowerCase().trim())
      );

      if (!hasApproverAuthority) {
        return NextResponse.json(
          { 
            error: "Access Denied", 
            message: "You do not have authorization to view this purchase request." 
          }, 
          { status: 403 }
        );
      }
    }

    // --- DATA ASSEMBLY & HARDENING ---
    try {
      const safeApprovals = Array.isArray(requestApprovals) ? requestApprovals : [];
      
      const deptStakeholders = await db
        .select({
          id: users.id,
          username: users.username,
          department: users.department,
          assignedDepartments: users.assignedDepartments,
        })
        .from(users)
        .where(inArray(users.role, ['approver', 'admin', 'super_admin']));

      // Map stakeholders to each approval step
      const approvalsWithStakeholders = safeApprovals.map((approval: any) => ({
        ...approval,
        stakeholders: deptStakeholders.filter((s: any) => {
          if (!approval.department) return false;
          const sNormalized = normalizeDepartmentAssignments(s.assignedDepartments, s.department);
          const sDepts = [
            s.department,
            ...sNormalized.filter(a => a.status === 'active' && (a.role === 'approver' || a.role === 'both')).map(a => a.department)
          ].filter(Boolean).map(d => d.toLowerCase().trim());
          return sDepts.includes(approval.department.toLowerCase().trim());
        })
      }));

      // Parse JSON fields (Items & Additional Approvers are text columns in DB)
      const parseJsonArray = (data: any, label: string) => {
        if (!data) return [];
        if (Array.isArray(data)) return data;
        if (typeof data !== "string") return [];
        try {
          const parsed = JSON.parse(data);
          return Array.isArray(parsed) ? parsed : [];
        } catch (e: any) {
          console.warn(`[API] Failed to parse ${label} for request ${requestId}:`, e.message);
          return [];
        }
      };

      const parsedItems = safeParseItems(request.items);
      const parsedApprovers = parseJsonArray(request.additionalApprovers, "additionalApprovers");

      return NextResponse.json({
        ...request,
        department: request.department || requester?.department,
        items: parsedItems,
        additionalApprovers: parsedApprovers,
        requester: requester || null,
        vendor: vendor || null,
        subPurpose: subPurpose || null,
        approvals: approvalsWithStakeholders,
        attachments: Array.isArray(attachments) ? attachments : [],
        paymentInstallments: Array.isArray(installments) ? installments : [],
        auditLogs: Array.isArray(requestAuditLogs) ? requestAuditLogs : []
      });
    } catch (assemblyError: any) {
      console.error("[Native API] Data Assembly Failure:", {
        message: assemblyError.message,
        requestId,
        userId: authenticatedUser?.id
      });
      throw assemblyError; // Re-throw to be caught by the outer catch block
    }
  } catch (error: any) {
    console.error("[Native API] GET Request Detail Error:", {
      message: error.message,
      stack: error.stack,
      requestId,
      userId: authenticatedUser?.id
    });
    return NextResponse.json({ 
      error: "Internal Server Error", 
      details: error.message,
      code: "SYSTEM_RUNTIME_ERR_001"
    }, { status: 500 });
  }
}

// PATCH /api/requests/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: paramId } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const requestId = parseInt(paramId);
    if (isNaN(requestId)) return NextResponse.json({ error: "Invalid request ID" }, { status: 400 });

    const rawBody = await req.json();
    const validation = updateRequestSchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json({ error: "Validation Failed", details: validation.error.format() }, { status: 400 });
    }
    const updateData = validation.data;

    const [existing] = await db
      .select()
      .from(purchaseRequests)
      .where(eq(purchaseRequests.id, requestId))
      .limit(1);

    if (!existing) return NextResponse.json({ error: "Request not found" }, { status: 404 });

    // ─── AUTHENTICATION & AUTHORITY GATEKEEPING ────────────────────────────────
    const isAdmin = user.role === 'admin' || user.role === 'super_admin';
    const userDepts = (user.departments || [user.department]).map(d => d.toLowerCase().trim());
    const isFinance = userDepts.includes('finance');
    const isOwner = existing.requesterId === user.id;

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: "Access Denied" }, { status: 403 });
    }

    // Check for existing approvals to determine locking
    const [approvedCountRecord] = await db
      .select({ countValue: count() })
      .from(approvals)
      .where(and(eq(approvals.requestId, requestId), eq(approvals.status, "approved")));
    const approvedCount = Number(approvedCountRecord?.countValue || 0);

    // Lock Check: 
    // - Admins can ALWAYS edit unless 'fully_paid' or 'archived' (future proofing)
    // - Requesters can edit if status is 'draft', 'rejected', 'changes_requested'
    // - Requesters can edit 'pending' ONLY if approvedCount is 0
    const isLockedStatus = !["draft", "rejected", "changes_requested", "pending"].includes(existing.status);
    const isLockedForRequester = existing.status === "pending" && approvedCount > 0;

    if (!isAdmin && (isLockedStatus || isLockedForRequester)) {
      return NextResponse.json({ 
        error: "Request Locked", 
        message: isLockedForRequester 
          ? "This request has already received departmental approvals and is locked for editing. Please contact an Admin for force-updates."
          : `This request is currently "${existing.status}" and cannot be modified.` 
      }, { status: 403 });
    }

    // ─── FINANCE VARIATION BYPASS ──────────────────────────────────────────────
    const isVariationOnly = updateData.revisedTotalCost !== undefined && Object.keys(updateData).length === 1;

    if ((isAdmin || isFinance) && isVariationOnly) {
      const newTotal = Math.round(Number(updateData.revisedTotalCost));
      const [updated] = await db.update(purchaseRequests)
        .set({ revisedTotalCost: newTotal, updatedAt: new Date() })
        .where(eq(purchaseRequests.id, requestId))
        .returning();
      return NextResponse.json(updated);
    }

    // Sanitize update data
    const { requester, vendor, subPurpose, approvals: _a, attachments: _att, attachmentIds, id: _id, revisedTotalCost: _rvc, installments, paymentStructure, ...cleanData } = rawBody;

    // Financial Integer Safety
    if (cleanData.totalEstimatedCost !== undefined) cleanData.totalEstimatedCost = Math.round(Number(cleanData.totalEstimatedCost));
    if (cleanData.freightAmount !== undefined) cleanData.freightAmount = Math.round(Number(cleanData.freightAmount));

    const updatedTotalCost = (cleanData.totalEstimatedCost ?? existing.totalEstimatedCost) + (cleanData.freightAmount ?? existing.freightAmount ?? 0);
    const updatedCurrency = cleanData.currency ?? existing.currency ?? "QAR";
    const activeRate = await getExchangeRateToQAR(updatedCurrency);
    
    cleanData.baseAmountQar = Math.round(updatedTotalCost * activeRate);
    cleanData.exchangeRate = activeRate.toString();
    if (paymentStructure) cleanData.paymentStructure = paymentStructure;

    // Handle array primitives converting to DB text columns for storage
    const itemsJson = cleanData.items && Array.isArray(cleanData.items) ? JSON.stringify(cleanData.items) : null;
    const approversJson = cleanData.additionalApprovers && Array.isArray(cleanData.additionalApprovers) ? JSON.stringify(cleanData.additionalApprovers) : null;

    if (itemsJson) cleanData.items = itemsJson as any;
    if (approversJson) cleanData.additionalApprovers = approversJson as any;

    if (cleanData.createdAt) cleanData.createdAt = new Date(cleanData.createdAt);
    if (cleanData.updatedAt) cleanData.updatedAt = new Date(cleanData.updatedAt);

    // ─── INTELLIGENT WORKFLOW RESET (Diffing) ──────────────────────────────────
    // We reset the workflow IF line items, total cost, or vendor changes.
    // Minor text changes (title, description, priority) preserve signatures.
    const hasFinancialChange = 
      (cleanData.totalEstimatedCost !== undefined && cleanData.totalEstimatedCost !== existing.totalEstimatedCost) ||
      (cleanData.vendorId !== undefined && cleanData.vendorId !== existing.vendorId) ||
      (itemsJson !== null && itemsJson !== JSON.stringify(existing.items));

    const isWithdrawal = existing.status === "pending" && cleanData.status === "draft";
    const forceReset = isWithdrawal || hasFinancialChange || existing.status === "changes_requested";

    if (forceReset && approvedCount > 0) {
      // Wipe approvals: The signatures are no longer valid for the new terms.
      await db.delete(approvals).where(eq(approvals.requestId, requestId));
      
      // Log the reset
      await db.insert(auditLogs).values({
        resourceId: requestId,
        resourceType: "purchase_request",
        action: hasFinancialChange ? "MODIFIED_RESET" : "WITHDRAWN",
        userId: user.id,
        details: { reason: "Financial/Scope change detected. Signatures invalidated.", changedFields: hasFinancialChange ? "Financials" : "Manual Withdrawal" },
        timestamp: new Date(),
      });
    }

    if (existing.status === "draft" || existing.status === "changes_requested" || forceReset) {
      if (!isWithdrawal) {
        cleanData.status = "pending";
        // Re-seed approvals by tricking the system into thinking it's transitioning to pending
        updateData.status = "pending"; 
      }
    } else {
      // SECURITY FIX: Never allow the client to arbitrarily update the status via PUT
      // unless it's explicitly handled by the state transitions above.
      delete cleanData.status;
    }

    let isTransitioningToPending = updateData.status === "pending" && (existing.status === "draft" || existing.status === "changes_requested" || forceReset);

    if (isTransitioningToPending) {
      const targetVendorId = cleanData.vendorId ?? existing.vendorId;
      if (targetVendorId) {
        // Non-blocking evaluation in accordance with approved vendor redesign
        await evaluateCompliance(targetVendorId, requestId);
        try {
          await capturePrComplianceSnapshot(requestId, targetVendorId, "resubmission", user.id);
        } catch (snapErr) {
          console.warn("[PATCH /api/requests/[id]] Warning: Failed to capture PR compliance snapshot:", snapErr);
        }
      }
    }

    const [updated] = await db
      .update(purchaseRequests)
      .set({ 
        ...cleanData, 
        updatedAt: new Date(),
        // Re-lock if it's still pending or being submitted
        isLocked: cleanData.status === "pending" || (existing.status === "pending" && !forceReset)
      })
      .where(eq(purchaseRequests.id, requestId))
      .returning();

    // Link any newly uploaded attachments
    if (attachmentIds && Array.isArray(attachmentIds) && attachmentIds.length > 0) {
      await db.update(fileAttachments)
        .set({ requestId: requestId })
        .where(inArray(fileAttachments.id, attachmentIds));
    }

    // Process updated installments ONLY if not approved and provided
    if (installments && Array.isArray(installments) && existing.status !== "approved" && existing.status !== "partially_approved") {
      await db.delete(paymentInstallments).where(eq(paymentInstallments.requestId, requestId));
      
      let finalInstallments: any[] = [];
      const targetPaymentStructure = paymentStructure || existing.paymentStructure;
      const targetVendorId = cleanData.vendorId || existing.vendorId;

      if (targetPaymentStructure === "IN_PARTS" && installments.length > 0) {
        finalInstallments = installments.map((inst: any) => ({
          requestId: requestId,
          vendorId: targetVendorId,
          installmentName: inst.installmentName,
          dueDate: new Date(inst.dueDate),
          valueType: inst.valueType,
          amountValue: inst.amountValue,
          calculatedAmount: inst.valueType === "PERCENTAGE"
            ? Math.round((inst.amountValue / 100) * updatedTotalCost)
            : Math.round(Number(inst.amountValue) || 0),
          currency: updatedCurrency,
          exchangeRate: activeRate.toString(),
          calculatedAmountQar: Math.round(
            (inst.valueType === "PERCENTAGE"
              ? Math.round((inst.amountValue / 100) * updatedTotalCost)
              : Math.round(Number(inst.amountValue) || 0)) * activeRate
          ),
          createdBy: user.id,
        }));
      } else {
        finalInstallments = [{
          requestId: requestId,
          vendorId: targetVendorId,
          installmentName: targetPaymentStructure === "ADVANCE" ? "100% Advance Payment" : "Post-Project Settlement",
          dueDate: new Date(),
          valueType: "PERCENTAGE",
          amountValue: 100,
          calculatedAmount: updatedTotalCost,
          currency: updatedCurrency,
          exchangeRate: activeRate.toString(),
          calculatedAmountQar: cleanData.baseAmountQar,
          createdBy: user.id,
        }];
      }

      if (finalInstallments.length > 0) {
        await db.insert(paymentInstallments).values(finalInstallments);
      }
    }

    // Transition to pending: Create approval records and send notifications
    if (isTransitioningToPending) {
      const effectiveRequestDept = updated.department || existing.department || user.department;
      await seedInitialApprovals(requestId, user.id, user.department, user.role, updated.additionalApprovers, effectiveRequestDept, user.departments);

      // 4. Notifications
      const mandatoryDepts = ["Finance", "CEO Office", "Management"];
      let additionalDepts: string[] = [];
      try {
        if (typeof updated.additionalApprovers === 'string') {
          additionalDepts = JSON.parse(updated.additionalApprovers);
        } else if (Array.isArray(updated.additionalApprovers)) {
          additionalDepts = updated.additionalApprovers as string[];
        }
      } catch (e: any) {}
      const filteredAdditional = additionalDepts.filter((d: string) => !mandatoryDepts.includes(d));
      const allRequiredDepts = [...mandatoryDepts, ...filteredAdditional];

      // 4. Dispatch Notifications to authorized approvers of pending steps
      const pendingApprovals = await db
        .select({ department: approvals.department })
        .from(approvals)
        .where(and(eq(approvals.requestId, updated.id), eq(approvals.status, 'pending')));

      const pendingDepts = Array.from(new Set(pendingApprovals.map(a => a.department))).filter(Boolean);
      const targetDepts = pendingDepts.length > 0 ? pendingDepts : allRequiredDepts;

      const approverIds = await notificationService.getAuthorizedApproverUserIds({
        targetDepartments: targetDepts,
        excludeUserId: user.id,
      });

      if (approverIds.length > 0) {
        await notificationService.createPendingApprovalNotification({
          requestId: updated.id,
          requestTitle: updated.title,
          requesterName: user.username || 'Requester',
          requesterDepartment: updated.department || user.department,
          approverIds,
          targetDepartments: targetDepts,
        });
      }

      await db.update(purchaseRequests).set({ isLocked: true, updatedAt: new Date() }).where(eq(purchaseRequests.id, requestId));
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("[Native API] PUT Request Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * DELETE /api/requests/[id]
 * Deletes a purchase request if it has no approvals.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: paramId } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const requestId = parseInt(paramId);
    if (isNaN(requestId)) return NextResponse.json({ error: "Invalid request ID" }, { status: 400 });

    const [request] = await db
      .select()
      .from(purchaseRequests)
      .where(eq(purchaseRequests.id, requestId))
      .limit(1);

    if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });

    // Permissions: Creator (only until someone approved it) OR Super Admin (until any amount is paid)
    const isOwner = request.requesterId === user.id;
    const isSuperAdminUser = user.role?.toLowerCase() === 'super_admin';

    if (!isOwner && !isSuperAdminUser) {
      return NextResponse.json({ 
        error: "Access Denied", 
        message: "Requests can only be deleted by the user who created them (until approved) or by a Super Admin (until amount is paid)." 
      }, { status: 403 });
    }

    // Check approvals on the request
    const [approvedCountRecord] = await db
      .select({ countValue: count() })
      .from(approvals)
      .where(and(eq(approvals.requestId, requestId), eq(approvals.status, "approved")));
    
    const approvedCount = Number(approvedCountRecord?.countValue || 0);

    // Creator restriction: cannot delete once any approval has been granted
    if (isOwner && !isSuperAdminUser) {
      if (approvedCount > 0) {
        return NextResponse.json({ 
          error: "Compliance Rule", 
          message: "Once a purchase request has received an approval, it can no longer be deleted by the creator." 
        }, { status: 403 });
      }
    }

    // Super Admin restriction: cannot delete once any amount is paid
    if (isSuperAdminUser) {
      const isPaidStatus = ['fully_paid', 'partially_paid'].includes(request.status);

      const [paidInstallmentsRecord] = await db
        .select({ countValue: count() })
        .from(paymentInstallments)
        .where(
          and(
            eq(paymentInstallments.requestId, requestId),
            inArray(paymentInstallments.status, ['paid', 'partial', 'partially_paid'])
          )
        );
      const paidInstallmentsCount = Number(paidInstallmentsRecord?.countValue || 0);

      if (isPaidStatus || paidInstallmentsCount > 0) {
        return NextResponse.json({ 
          error: "Financial Compliance", 
          message: "This request cannot be deleted because financial disbursements/payments have already been recorded." 
        }, { status: 403 });
      }
    }

    // Action: Insert Tombstone Audit Log (Must do before deleting the request if it references it, but we keep audit logs)
    await db.insert(auditLogs).values({
      resourceId: requestId,
      resourceType: "purchase_request",
      action: "DELETED",
      userId: user.id,
      details: {
        requestNumber: request.requestNumber,
        title: request.title,
        deletedBy: user.username,
        role: user.role,
        reason: isSuperAdminUser ? "Super Admin deleted un-disbursed request" : "Creator deleted unapproved request"
      },
      timestamp: new Date(),
    });

    // Final Action: Delete Request (Cascading starts here for approvals, items, attachments)
    await db.delete(purchaseRequests).where(eq(purchaseRequests.id, requestId));

    return NextResponse.json({ message: "Request deleted successfully" });
  } catch (error: any) {
    console.error("[Native API] DELETE Request Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
