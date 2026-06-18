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
  vendors
} from "@db/schema";
import { eq, and, desc, inArray, gte, lte, count, or, ilike, sql } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { createRequestSchema } from "@/lib/validation";
import { evaluateCompliance } from "@/lib/core/compliance";
import { seedInitialApprovals } from "@/lib/core/workflow";

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
    const categoryFilter = searchParams.get("purposeCategoryId");
    const subPurposeFilter = searchParams.get("subPurpose");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const priority = searchParams.get("priority");
    const costMin = searchParams.get("costMin");
    const costMax = searchParams.get("costMax");
    const search = searchParams.get("search");
    const requestNo = searchParams.get("requestNo");

    const whereConditions: any[] = [];

    // Filter Logic
    if (status) {
      whereConditions.push(inArray(purchaseRequests.status, status.split(",")));
    }

    if (deptFilter) {
      whereConditions.push(eq(users.department, deptFilter));
    }

    if (vendorFilter) {
      whereConditions.push(eq(purchaseRequests.vendorId, parseInt(vendorFilter)));
    }

    if (purposeFilter) {
      whereConditions.push(eq(purchaseRequests.purposeType, purposeFilter));
    }

    if (categoryFilter) {
      whereConditions.push(eq(purchaseRequests.purposeCategoryId, parseInt(categoryFilter)));
    }

    if (subPurposeFilter) {
      whereConditions.push(eq(purchaseRequests.subPurposeId, parseInt(subPurposeFilter)));
    }

    if (dateFrom) {
      whereConditions.push(gte(purchaseRequests.createdAt, new Date(dateFrom)));
    }
    if (dateTo) {
      whereConditions.push(lte(purchaseRequests.createdAt, new Date(dateTo)));
    }

    if (priority) {
      whereConditions.push(inArray(purchaseRequests.priority, priority.split(",")));
    }

    if (costMin) {
      whereConditions.push(gte(purchaseRequests.totalEstimatedCost, parseInt(costMin)));
    }
    if (costMax) {
      whereConditions.push(lte(purchaseRequests.totalEstimatedCost, parseInt(costMax)));
    }

    if (requestNo) {
      whereConditions.push(ilike(purchaseRequests.requestNumber, `%${requestNo}%`));
    }

    if (search) {
      whereConditions.push(or(
        ilike(purchaseRequests.title, `%${search}%`),
        ilike(purchaseRequests.requestNumber, `%${search}%`)
      ));
    }

    // Role-based visibility
    const isAdmin = user.role === 'admin';

    if (!isAdmin) {
      whereConditions.push(
        or(
          eq(users.department, user.department),
          sql`EXISTS (SELECT 1 FROM ${approvals} WHERE ${approvals.requestId} = ${purchaseRequests.id} AND ${approvals.department} = ${user.department})`
        )
      );
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
        requester: {
          id: users.id,
          username: users.username,
          department: users.department,
          role: users.role,
        },
        approvedCount: sql<number>`(
          SELECT count(*) 
          FROM ${approvals} 
          WHERE ${approvals.requestId} = ${purchaseRequests.id} 
          AND ${approvals.status} = 'approved'
        )`.mapWith(Number),
      })
      .from(purchaseRequests)
      .innerJoin(users, eq(users.id, purchaseRequests.requesterId))
      .leftJoin(subPurposes, eq(subPurposes.id, purchaseRequests.subPurposeId))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(purchaseRequests.createdAt));

    // Race the query against the safety timeout
    const requests = await Promise.race([listPromise, timeoutPromise]);
    clearTimeout(timeoutHandle!); // Cancel the timer if query won

    return NextResponse.json(requests);
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
      return NextResponse.json({ 
        error: "Validation Failed", 
        details: validation.error.format() 
      }, { status: 400 });
    }

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
      purposeCategoryId,
      items,
      additionalApprovers,
      attachmentIds,
      paymentStructure,
      installments,
      status: requestedStatus
    } = validation.data;

    const totalEstimatedCostNum = Math.round(totalEstimatedCost || 0);
    const freightAmountNum = Math.round(freightAmount || 0);
    const vendorIdNum = vendorId;
    const totalCost = totalEstimatedCostNum + freightAmountNum;

    // --- COMPLIANCE HARD STOP (Backend Gatekeeper) ---
    // Draft submissions bypass the compliance gateway — users can save
    // incomplete requests and resolve vendor documentation later.
    if (requestedStatus !== "draft" && vendorIdNum) {
      const { isBlocked, message } = await evaluateCompliance(vendorIdNum);
      if (isBlocked) {
        return NextResponse.json({ 
          error: "Access Denied: Compliance Violation", 
          message 
        }, { status: 403 });
      }
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
          inArray(purchaseRequests.status, ["pending", "partially_approved", "approved"])
        ));

        const currentTotal = Number(spent.total);
        if (currentTotal + totalCost > budgetInfo.allocated) {
          console.warn(`[PR_GATEKEEPER] BLOCKED: Project "${budgetInfo.name}" budget exceeded by ${currentTotal + totalCost - budgetInfo.allocated} QAR`);
          return NextResponse.json({
            error: "Budget Capacity Exceeded",
            message: `The current request (${totalCost.toLocaleString()} QAR) exceeds the remaining institutional allocation for "${budgetInfo.name}". (Limit: ${budgetInfo.allocated.toLocaleString()} QAR | Remaining: ${(budgetInfo.allocated - currentTotal).toLocaleString()} QAR).`
          }, { status: 403 });
        }
      }
    }

    // Generate unique request number (PR-2026-XXXX)
    const year = new Date().getFullYear();
    const countResult = await db.select({ count: count() }).from(purchaseRequests);
    const nextNum = (Number(countResult[0]?.count) || 0) + 1;
    const requestNumber = `PR-${year}-${nextNum.toString().padStart(4, '0')}`;

    // --- Sequential Inserts (Neon HTTP driver is incompatible with db.transaction()) ---
    // 1. Insert the Purchase Request
    console.log("[POST /api/requests] Step 1: Inserting purchase request for user", user.id);
    const [newRequest] = await db
      .insert(purchaseRequests)
      .values({
        requestNumber,
        title: title || "Untitled Request",
        description: description || "",
        totalEstimatedCost: totalEstimatedCostNum,
        vendorId: vendorIdNum,
        purposeType: purposeType || "General",
        purposeCategoryId: purposeCategoryId ? Number(purposeCategoryId) : null,
        subPurposeId: subPurposeId ? Number(subPurposeId) : null,
        priority: priority || "medium",
        currency: currency || "QAR",
        freightAmount: freightAmountNum,
        requesterId: user.id,
        items: JSON.stringify(items || []) as any,
        additionalApprovers: JSON.stringify(additionalApprovers || []) as any,
        paymentStructure: paymentStructure || "POST_PROJECT",
        status: requestedStatus === "pending" ? "pending" : "draft",
        isLocked: requestedStatus === "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    console.log("[POST /api/requests] Step 1 OK: request id", newRequest.id);

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
      await seedInitialApprovals(newRequest.id, user.id, user.department, user.role, additionalApprovers);
    }

    return NextResponse.json(newRequest, { status: 201 });
  } catch (error: any) {
    console.error("[Native API] POST Request Error:", error?.message, error?.stack?.split('\n').slice(0,3).join(' | '));
    require('fs').writeFileSync('last_error.json', JSON.stringify({ message: error?.message, detail: error?.detail, code: error?.code, name: error?.name }, null, 2));
    return NextResponse.json({ error: error?.message || "Internal Server Error", detail: error?.detail || error?.code }, { status: 500 });
  }
}
