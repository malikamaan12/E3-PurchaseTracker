import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { 
  purchaseRequests, 
  users, 
  fileAttachments, 
  paymentInstallments,
  departments,
  approvals,
  auditLogs,
  subPurposes,
  vendors,
  itemCatalog
} from "@db/schema";
import { eq, ne, and, desc, inArray, gte, lte, count, or, ilike, sql } from "drizzle-orm";
import { getAuthenticatedUser, canCreateInDepartment, isDepartmentFrozen, normalizeDepartmentAssignments } from "@/lib/auth-next";
import { createRequestSchema } from "@/lib/validation";
import { evaluateCompliance, capturePrComplianceSnapshot } from "@/lib/core/compliance";
import { seedInitialApprovals } from "@/lib/core/workflow";
import { getExchangeRateToQAR } from "@/lib/utils/currency";
import { generateUniqueRequestId } from "@/lib/utils/request-number";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const deptFilter = searchParams.get("department");
    const vendorFilter = searchParams.get("vendor");
    const purposeFilter = searchParams.get("purpose");
    const categoryFilter = searchParams.get("purposeCategoryId") || searchParams.get("category");
    const subPurposeFilter = searchParams.get("subPurposeId") || searchParams.get("subPurpose");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const priority = searchParams.get("priority");
    const costMin = searchParams.get("costMin");
    const costMax = searchParams.get("costMax");
    const search = searchParams.get("search");
    const requestNo = searchParams.get("requestNo");

    // Role-based visibility & approval calculations
    const normalizedRole = user.role?.toLowerCase() || '';
    const isSuperAdmin = normalizedRole === 'super_admin' || normalizedRole === 'superadmin';
    const isAdmin = isSuperAdmin || normalizedRole === 'admin';
    const userDepts = (user.departments && user.departments.length > 0 ? user.departments : [user.department]).filter(Boolean);

    // Calculate which departments this user is authorized to APPROVE for
    const approverDepts: string[] = [];
    if ((normalizedRole === 'approver' || normalizedRole === 'admin') && user.department) {
      approverDepts.push(user.department);
    }
    const normalizedAssignments = user.departmentAssignments || normalizeDepartmentAssignments(user.assignedDepartments, user.department);
    for (const assignment of normalizedAssignments) {
      if (assignment.status === 'active' && (assignment.role === 'approver' || assignment.role === 'both')) {
        if (assignment.department && !approverDepts.includes(assignment.department)) {
          approverDepts.push(assignment.department);
        }
      }
    }

    const whereConditions: any[] = [];

    // Filter Logic
    if (status && status !== "all") {
      const statusArr = status.split(",").map(s => s.trim().toLowerCase());
      const expanded: string[] = [];
      let isMyQueueFilter = false;

      for (const s of statusArr) {
        if (s === "my_queue") {
          isMyQueueFilter = true;
          expanded.push("pending", "partially_approved", "pending_dept_head", "variation_pending");
        } else if (s === "pending") {
          expanded.push("pending", "partially_approved", "pending_dept_head", "variation_pending");
        } else if (s === "approved") {
          expanded.push("approved", "fully_paid");
        } else if (s === "rejected") {
          expanded.push("rejected", "cancelled");
        } else if (s === "cancelled") {
          expanded.push("cancelled");
        } else {
          expanded.push(s);
        }
      }
      whereConditions.push(inArray(purchaseRequests.status, Array.from(new Set(expanded))));

      if (isMyQueueFilter) {
        if (!isSuperAdmin) {
          const lowerApproverDepts = approverDepts.map(d => d.toLowerCase().trim()).filter(Boolean);
          if (lowerApproverDepts.length > 0) {
            const deptListSql = sql.join(lowerApproverDepts.map(d => sql`${d}`), sql`, `);
            whereConditions.push(
              or(
                sql`EXISTS (
                  SELECT 1 FROM ${approvals} 
                  WHERE ${approvals.requestId} = ${purchaseRequests.id} 
                  AND ${approvals.status} IN ('pending', 'changes_requested') 
                  AND LOWER(TRIM(${approvals.department})) IN (${deptListSql})
                )`,
                sql`(${purchaseRequests.status} = 'pending_dept_head' AND LOWER(TRIM(COALESCE(${purchaseRequests.department}, ${users.department}))) IN (${deptListSql}))`
              )
            );
          } else {
            whereConditions.push(sql`1 = 0`);
          }
        } else {
          whereConditions.push(
            or(
              sql`EXISTS (SELECT 1 FROM ${approvals} WHERE ${approvals.requestId} = ${purchaseRequests.id} AND ${approvals.status} IN ('pending', 'changes_requested'))`,
              sql`${purchaseRequests.status} = 'pending_dept_head'`
            )
          );
        }
      }
    }

    if (deptFilter && deptFilter !== "all") {
      const trimmedDept = deptFilter.trim();
      whereConditions.push(
        or(
          sql`LOWER(TRIM(COALESCE(${purchaseRequests.department}, ${users.department}))) = LOWER(TRIM(${trimmedDept}))`,
          sql`EXISTS (
            SELECT 1 FROM ${approvals} 
            WHERE ${approvals.requestId} = ${purchaseRequests.id} 
            AND LOWER(TRIM(${approvals.department})) = LOWER(TRIM(${trimmedDept}))
          )`
        )
      );
    }

    if (vendorFilter && vendorFilter !== "all") {
      const vId = parseInt(vendorFilter, 10);
      if (!isNaN(vId)) {
        whereConditions.push(eq(purchaseRequests.vendorId, vId));
      }
    }

    if (purposeFilter && purposeFilter !== "all") {
      whereConditions.push(eq(purchaseRequests.purposeType, purposeFilter));
    }

    if (categoryFilter && categoryFilter !== "all") {
      const cId = parseInt(categoryFilter, 10);
      if (!isNaN(cId)) {
        whereConditions.push(eq(purchaseRequests.purposeCategoryId, cId));
      }
    }

    if (subPurposeFilter && subPurposeFilter !== "all") {
      const spId = parseInt(subPurposeFilter, 10);
      if (!isNaN(spId)) {
        whereConditions.push(eq(purchaseRequests.subPurposeId, spId));
      }
    }

    if (priority && priority !== "all") {
      whereConditions.push(eq(purchaseRequests.priority, priority));
    }

    if (costMin) {
      whereConditions.push(gte(purchaseRequests.totalEstimatedCost, parseInt(costMin, 10)));
    }

    if (costMax) {
      whereConditions.push(lte(purchaseRequests.totalEstimatedCost, parseInt(costMax, 10)));
    }

    if (dateFrom) {
      whereConditions.push(gte(purchaseRequests.createdAt, new Date(dateFrom)));
    }

    if (dateTo) {
      whereConditions.push(lte(purchaseRequests.createdAt, new Date(dateTo)));
    }

    if (requestNo) {
      whereConditions.push(ilike(purchaseRequests.requestNumber, `%${requestNo}%`));
    }

    if (search) {
      const searchPattern = `%${search}%`;
      whereConditions.push(or(
        ilike(purchaseRequests.title, searchPattern),
        ilike(purchaseRequests.requestNumber, searchPattern),
        ilike(sql`COALESCE(${purchaseRequests.department}, ${users.department})`, searchPattern),
        ilike(users.username, searchPattern),
        ilike(users.department, searchPattern),
        ilike(subPurposes.name, searchPattern),
        ilike(vendors.companyName, searchPattern),
        ilike(purchaseRequests.purposeType, searchPattern),
        sql`EXISTS (
          SELECT 1 FROM ${approvals} 
          WHERE ${approvals.requestId} = ${purchaseRequests.id} 
          AND LOWER(TRIM(${approvals.department})) ILIKE LOWER(TRIM(${searchPattern}))
        )`
      ));
    }

    // 1. Isolation for pending_dept_head requests:
    // Only super_admin, the supervisor (requester), or someone from the submitting department can see it.
    if (!isSuperAdmin) {
      const lowerUserDepts = userDepts.map((d: any) => String(d).toLowerCase().trim()).filter(Boolean);
      if (lowerUserDepts.length > 0) {
        const userDeptListSql = sql.join(lowerUserDepts.map((d: string) => sql`${d}`), sql`, `);
        whereConditions.push(
          or(
            ne(purchaseRequests.status, 'pending_dept_head'),
            sql`LOWER(TRIM(COALESCE(${purchaseRequests.department}, ${users.department}))) IN (${userDeptListSql})`,
            eq(purchaseRequests.requesterId, user.id)
          )
        );
      } else {
        whereConditions.push(
          or(
            ne(purchaseRequests.status, 'pending_dept_head'),
            eq(purchaseRequests.requesterId, user.id)
          )
        );
      }
    }

    // 2. Department & Role Scoping for non-admins:
    // - Users always see requests originating from their department or submitted by them.
    // - ONLY users with active approver roles in an approval department see cross-department requests requiring their approval.
    if (!isAdmin) {
      const lowerUserDepts = userDepts.map((d: any) => String(d).toLowerCase().trim()).filter(Boolean);
      const lowerApproverDepts = approverDepts.map((d: any) => String(d).toLowerCase().trim()).filter(Boolean);

      const visibilityConditions: any[] = [
        eq(purchaseRequests.requesterId, user.id)
      ];

      if (lowerUserDepts.length > 0) {
        const userDeptListSql = sql.join(lowerUserDepts.map((d: string) => sql`${d}`), sql`, `);
        visibilityConditions.push(
          sql`LOWER(TRIM(COALESCE(${purchaseRequests.department}, ${users.department}))) IN (${userDeptListSql})`
        );
      }

      if (lowerApproverDepts.length > 0) {
        const approverDeptListSql = sql.join(lowerApproverDepts.map((d: string) => sql`${d}`), sql`, `);
        visibilityConditions.push(
          sql`EXISTS (
            SELECT 1 FROM ${approvals} 
            WHERE ${approvals.requestId} = ${purchaseRequests.id} 
            AND LOWER(TRIM(${approvals.department})) IN (${approverDeptListSql})
          )`
        );
      }

      whereConditions.push(or(...visibilityConditions));
    }

    let timeoutHandle: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(
        () => reject(new Error("Database synchronization timeout")),
        8000
      );
    });

    const listPromise = db
      .select({
        id: purchaseRequests.id,
        requestNumber: purchaseRequests.requestNumber,
        title: purchaseRequests.title,
        status: purchaseRequests.status,
        department: sql<string>`COALESCE(${purchaseRequests.department}, ${users.department})`,
        totalEstimatedCost: purchaseRequests.totalEstimatedCost,
        createdAt: purchaseRequests.createdAt,
        updatedAt: purchaseRequests.updatedAt,
        purposeType: purchaseRequests.purposeType,
        purposeCategoryId: purchaseRequests.purposeCategoryId,
        priority: purchaseRequests.priority,
        isLocked: purchaseRequests.isLocked,
        subPurpose: {
          id: subPurposes.id,
          name: subPurposes.name,
        },
        vendor: {
          id: vendors.id,
          name: vendors.companyName,
        },
        requester: {
          id: users.id,
          username: sql<string>`COALESCE(${users.username}, 'Unknown Requester')`,
          department: sql<string>`COALESCE(${users.department}, ${purchaseRequests.department}, 'General')`,
          role: users.role,
        },
        approvals: sql<any>`COALESCE((
          SELECT json_agg(json_build_object(
            'id', ${approvals.id},
            'department', ${approvals.department},
            'status', ${approvals.status},
            'isMandatory', ${approvals.isMandatory},
            'approverId', ${approvals.approverId},
            'comments', ${approvals.comments},
            'processedAt', ${approvals.processedAt}
          ) ORDER BY ${approvals.id})
          FROM ${approvals}
          WHERE ${approvals.requestId} = ${purchaseRequests.id}
        ), '[]'::json)`,
        paidAmount: sql<number>`COALESCE((
          SELECT sum(COALESCE(${paymentInstallments.paidAmount}, ${paymentInstallments.calculatedAmountQar}, 0))
          FROM ${paymentInstallments}
          WHERE ${paymentInstallments.requestId} = ${purchaseRequests.id}
          AND ${paymentInstallments.status} = 'paid'
        ), 0)`.mapWith(Number),
        paidInstallmentsCount: sql<number>`COALESCE((
          SELECT count(*)
          FROM ${paymentInstallments}
          WHERE ${paymentInstallments.requestId} = ${purchaseRequests.id}
          AND ${paymentInstallments.status} = 'paid'
        ), 0)`.mapWith(Number),
        totalInstallmentsCount: sql<number>`COALESCE((
          SELECT count(*)
          FROM ${paymentInstallments}
          WHERE ${paymentInstallments.requestId} = ${purchaseRequests.id}
        ), 0)`.mapWith(Number),
        approvedCount: sql<number>`(
          SELECT count(*) 
          FROM ${approvals} 
          WHERE ${approvals.requestId} = ${purchaseRequests.id} 
          AND ${approvals.status} = 'approved'
        )`.mapWith(Number),
      })
      .from(purchaseRequests)
      .leftJoin(users, eq(users.id, purchaseRequests.requesterId))
      .leftJoin(subPurposes, eq(subPurposes.id, purchaseRequests.subPurposeId))
      .leftJoin(vendors, eq(vendors.id, purchaseRequests.vendorId))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(purchaseRequests.createdAt))
      .limit(searchParams.has("limit") ? parseInt(searchParams.get("limit") as string, 10) : 100);

    // Race the query against the safety timeout
    listPromise.catch(() => {}); // Prevent unhandled promise rejection if query fails after timeout
    const requests = await Promise.race([listPromise, timeoutPromise]);
    clearTimeout(timeoutHandle!); // Cancel the timer if query won

    return NextResponse.json(requests, {
      headers: {
        'Cache-Control': 'private, s-maxage=10, stale-while-revalidate=30',
      },
    });
  } catch (error: any) {
    if (error?.message === "Database synchronization timeout") {
      console.warn("[Native API] GET Requests: Query timed out — returning empty list");
      return NextResponse.json([], { status: 200 });
    }
    console.error("[Native API] GET Requests Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = await req.json();
    
    // 1. Strict Payload Validation (Zod Hardening)
    const validation = createRequestSchema.safeParse(body);
    if (!validation.success) {
      const errorMsg = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(", ");
      return NextResponse.json({ 
        error: "Validation Failed", 
        message: errorMsg || "Invalid request payload",
        details: validation.error.format() 
      }, { status: 400 });
    }

    const { 
      title, 
      description, 
      department: requestedDept,
      totalEstimatedCost, 
      vendorId, 
      purposeType, 
      priority,
      currency,
      freightAmount,
      subPurposeId,
      purposeCategoryId,
      items,
      additionalApprovers,
      attachmentIds,
      paymentStructure,
      installments,
      status: requestedStatus
    } = validation.data;

    if (requestedStatus === "pending") {
      if (!vendorId || vendorId <= 0) {
        return NextResponse.json({ error: "Validation Failed", message: "Please select a vendor before submitting for approval." }, { status: 400 });
      }
      if (!items || items.length === 0) {
        return NextResponse.json({ error: "Validation Failed", message: "At least one line item is required before submitting for approval." }, { status: 400 });
      }
    }

    // --- Submitting Department Authority Resolution ---
    let effectiveDept = user.department;
    if (requestedDept) {
      if (isDepartmentFrozen(user, requestedDept)) {
        return NextResponse.json({ error: `Department access for "${requestedDept}" is currently frozen.` }, { status: 403 });
      }
      if (!canCreateInDepartment(user, requestedDept)) {
        return NextResponse.json({ error: `You do not have request submission privileges for department "${requestedDept}".` }, { status: 403 });
      }
      effectiveDept = requestedDept.trim();
    }

    // --- SECURITY PATCH: Trust No Client Payload ---
    // Recalculate actual sum from items to prevent client-side manipulation of budget.
    const safeItems = Array.isArray(items) ? items : [];
    const calculatedItemsTotal = safeItems.reduce((sum, item) => sum + (item.quantity * item.estimatedCost), 0);
    const totalEstimatedCostNum = Math.round(calculatedItemsTotal);
    const freightAmountNum = Math.round(freightAmount || 0);
    const vendorIdNum = vendorId || null;
    const totalCost = totalEstimatedCostNum + freightAmountNum;
    
    // --- Currency Conversion Lock-In ---
    const activeRate = await getExchangeRateToQAR(currency || "QAR");
    const baseAmountQar = Math.round(totalCost * activeRate);
    // --- NON-BLOCKING COMPLIANCE CHECK ---
    // In accordance with the approved vendor redesign, missing or incomplete vendor
    // compliance information NEVER blocks PR creation, submission, or approval.
    let complianceWarning: string | undefined;
    if (vendorIdNum) {
      const complianceResult = await evaluateCompliance(vendorIdNum);
      complianceWarning = complianceResult.warning;
    }

    // --- BUDGET HARD STOP (Backend Gatekeeper) ---
    if (subPurposeId && requestedStatus === "pending") {
      const [budgetInfo] = await db.select({
        allocated: subPurposes.totalBudget,
        name: subPurposes.name
      })
      .from(subPurposes)
      .where(eq(subPurposes.id, subPurposeId))
      .limit(1);

      if (budgetInfo) {
        // Calculate current utilization for this project
        const [spent] = await db.select({
          total: sql<number>`COALESCE(SUM(${purchaseRequests.totalEstimatedCost} + ${purchaseRequests.freightAmount}), 0)`
        })
        .from(purchaseRequests)
        .where(and(
          eq(purchaseRequests.subPurposeId, subPurposeId),
          inArray(purchaseRequests.status, ["pending", "pending_dept_head", "approved"])
        ));

        const currentSpent = Number(spent?.total || 0);
        const remainingBudget = Number(budgetInfo.allocated) - currentSpent;

        if (totalCost > remainingBudget) {
          return NextResponse.json({
            error: "Budget Exceeded",
            message: `Request total (${totalCost.toLocaleString()} QAR) exceeds remaining budget (${remainingBudget.toLocaleString()} QAR) for project "${budgetInfo.name}". Please submit a budget variation or reduce item quantities.`
          }, { status: 400 });
        }
      }
    }

    // Generate unique structured request number (PROJECT-DEPARTMENT-DATE-SEQUENCE)
    let projectNameStr: string | null = null;
    if (subPurposeId) {
      const [proj] = await db.select({ name: subPurposes.name }).from(subPurposes).where(eq(subPurposes.id, subPurposeId)).limit(1);
      if (proj) projectNameStr = proj.name;
    }

    const countResult = await db.select({ count: count() }).from(purchaseRequests);
    const nextNum = (Number(countResult[0]?.count) || 0) + 1;

    const requestNumber = generateUniqueRequestId({
      projectName: projectNameStr,
      departmentName: effectiveDept,
      date: new Date(),
      sequence: nextNum
    });

    const isSupervisor = user.role === 'supervisor';
    const initialStatus = requestedStatus === "pending"
      ? (isSupervisor ? "pending_dept_head" : "pending")
      : "draft";

    // --- Sequential Inserts (Neon HTTP driver is incompatible with db.transaction()) ---
    // 1. Insert the Purchase Request
    console.log("[POST /api/requests] Step 1: Inserting purchase request for user", user.id, "dept:", effectiveDept);
    const [newRequest] = await db
      .insert(purchaseRequests)
      .values({
        requestNumber,
        title: title || "Untitled Request",
        description: description || "",
        department: effectiveDept,
        totalEstimatedCost: totalEstimatedCostNum,
        vendorId: vendorIdNum,
        purposeType: purposeType || "General",
        purposeCategoryId: purposeCategoryId ? Number(purposeCategoryId) : null,
        subPurposeId: subPurposeId ? Number(subPurposeId) : null,
        priority: priority || "medium",
        currency: currency || "QAR",
        exchangeRate: activeRate.toString(),
        baseAmountQar: baseAmountQar,
        freightAmount: freightAmountNum,
        requesterId: user.id,
        items: JSON.stringify(items || []) as any,
        additionalApprovers: JSON.stringify(additionalApprovers || []) as any,
        paymentStructure: paymentStructure || "POST_PROJECT",
        status: initialStatus,
        isLocked: requestedStatus === "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    console.log("[POST /api/requests] Step 1 OK: request id", newRequest.id, "initialStatus:", initialStatus);

    // 1.2 Capture Non-Blocking Compliance Snapshot
    if (vendorIdNum && requestedStatus !== "draft") {
      try {
        await capturePrComplianceSnapshot(newRequest.id, vendorIdNum, "submission", user.id);
      } catch (snapErr) {
        console.warn("[POST /api/requests] Warning: Failed to capture PR compliance snapshot:", snapErr);
      }
    }

    // 1.5 Learn Items for Catalog
    if (items && Array.isArray(items) && items.length > 0) {
      try {
        const uniqueItems = Array.from(new Map(items.map((i: any) => [i.name, i])).values()) as any[];
        const catalogItems = uniqueItems.map((item: any) => ({
          name: item.name,
          defaultCost: Math.round(item.estimatedCost),
          category: purposeType || "General",
        }));
        await db.insert(itemCatalog)
          .values(catalogItems)
          .onConflictDoNothing({ target: itemCatalog.name });
      } catch (e) {
        console.error("Failed to learn items for catalog", e);
      }
    }

    // 2. Link attachments if provided
    console.log("[POST /api/requests] Step 2: Linking attachments", attachmentIds);
    if (attachmentIds && Array.isArray(attachmentIds) && attachmentIds.length > 0) {
      await db.update(fileAttachments)
        .set({ requestId: newRequest.id })
        .where(inArray(fileAttachments.id, attachmentIds));
    }

    // 3. Process Strategic Payout Installments
    let finalInstallments: any[] = [];

    if (paymentStructure === "IN_PARTS" && Array.isArray(installments) && installments.length > 0) {
      finalInstallments = installments.map((inst: any) => ({
        requestId: newRequest.id,
        vendorId: vendorIdNum,
        installmentName: inst.installmentName,
        dueDate: new Date(inst.dueDate),
        valueType: inst.valueType,
        amountValue: inst.amountValue,
        calculatedAmount: inst.valueType === "PERCENTAGE"
          ? Math.round((inst.amountValue / 100) * totalCost)
          : Math.round(Number(inst.amountValue) || 0),
        currency: currency || "QAR",
        exchangeRate: activeRate.toString(),
        calculatedAmountQar: Math.round(
          (inst.valueType === "PERCENTAGE"
            ? Math.round((inst.amountValue / 100) * totalCost)
            : Math.round(Number(inst.amountValue) || 0)) * activeRate
        ),
        createdBy: user.id,
      }));
    } else {
      finalInstallments = [{
        requestId: newRequest.id,
        vendorId: vendorIdNum,
        installmentName: paymentStructure === "ADVANCE" ? "100% Advance Payment" : "Post-Project Settlement",
        dueDate: new Date(),
        valueType: "PERCENTAGE",
        amountValue: 100,
        calculatedAmount: totalCost,
        currency: currency || "QAR",
        exchangeRate: activeRate.toString(),
        calculatedAmountQar: baseAmountQar,
        createdBy: user.id,
      }];
    }

    console.log("[POST /api/requests] Step 3: Inserting", finalInstallments.length, "installments");
    if (finalInstallments.length > 0) {
      await db.insert(paymentInstallments).values(finalInstallments);
    }
    console.log("[POST /api/requests] Step 3 OK");

    // 4. Approval row seeding on direct submission to "pending"
    if (requestedStatus === "pending") {
      await seedInitialApprovals(newRequest.id, user.id, user.department, user.role, additionalApprovers, effectiveDept, user.departments);
      
      // 5. Dispatch Notifications strictly to authorized approvers
      try {
        const { notificationService } = await import("@/lib/services/NotificationService");
        
        // Query the pending approval rows seeded for this request
        const pendingApprovalRows = await db
          .select({ department: approvals.department })
          .from(approvals)
          .where(and(eq(approvals.requestId, newRequest.id), eq(approvals.status, 'pending')));

        const pendingDepts = Array.from(new Set(pendingApprovalRows.map(a => a.department))).filter(Boolean);
        const targetDepts = isSupervisor
          ? [effectiveDept]
          : (pendingDepts.length > 0 ? pendingDepts : [effectiveDept]);

        const approverIds = await notificationService.getAuthorizedApproverUserIds({
          targetDepartments: targetDepts,
          excludeUserId: user.id,
        });

        if (approverIds.length > 0) {
          const reqTitle = isSupervisor
            ? `[Dept Review: ${effectiveDept}] ${newRequest.title}`
            : newRequest.title;
          const reqName = isSupervisor
            ? `${user.username} (Supervisor - ${effectiveDept})`
            : (user.username || 'System User');

          await notificationService.createPendingApprovalNotification({
            requestId: newRequest.id,
            requestTitle: reqTitle,
            requesterName: reqName,
            requesterDepartment: effectiveDept,
            approverIds,
            targetDepartments: targetDepts,
          });
        }
      } catch (err) {
        console.error("[Notification] Failed to dispatch push notifications:", err);
      }
    }

    return NextResponse.json(newRequest, { status: 201 });
  } catch (error: any) {
    console.error("[Native API] POST Request Error:", error?.message, error?.stack?.split('\n').slice(0,3).join(' | '));
    require('fs').writeFileSync('last_error.json', JSON.stringify({ message: error?.message, detail: error?.detail, code: error?.code, name: error?.name }, null, 2));
    return NextResponse.json({ error: error?.message || "Internal Server Error", detail: error?.detail || error?.code }, { status: 500 });
  }
}
