import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { 
  purchaseRequests, 
  users, 
  fileAttachments, 
  paymentInstallments,
  departments,
  approvals,
  auditLogs
} from "@db/schema";
import { eq, and, desc, inArray, gte, lte, count } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";

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

    // Role-based visibility
    const isAdmin = user.role === 'admin';
    const isApprover = user.isApprover === true;

    if (!isAdmin && !isApprover) {
      whereConditions.push(eq(users.department, user.department));
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
        purposeCategoryId: purchaseRequests.purposeCategoryId,
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

    return NextResponse.json(requests);
  } catch (error: any) {
    console.error("[Native API] GET Requests Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = await req.json();
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
      paymentStructure, // NEW: 'ADVANCE', 'IN_PARTS', 'POST_PROJECT'
      installments    // NEW: Array of installment objects
    } = body;

    const totalEstimatedCostNum = Math.round(Number(totalEstimatedCost) || 0);
    const freightAmountNum = Math.round(Number(freightAmount) || 0);
    const vendorIdNum = Number(vendorId);

    if (isNaN(vendorIdNum)) return NextResponse.json({ error: "Invalid Vendor ID" }, { status: 400 });

    const totalCost = totalEstimatedCostNum + freightAmountNum;

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
        status: body.status === "pending" ? "pending" : "draft",
        isLocked: body.status === "pending",
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
        amount: inst.valueType === "PERCENTAGE"
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
        amount: totalCost,
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
    if (body.status === "pending") {
      // Always guarantee exactly the three mandatory gatekeeper departments
      const mandatoryDepts = ["Finance", "CEO Office", "General Manager"];

      // Additional approvers must not overlap with mandatory
      const filteredAdditional = (additionalApprovers || []).filter(
        (d: string) => !mandatoryDepts.includes(d)
      );
      const allRequiredDepts = [...mandatoryDepts, ...filteredAdditional];

      for (const dept of allRequiredDepts) {
        const isMandatory = mandatoryDepts.includes(dept);
        // Mandatory gatekeeper rows are NEVER auto-approved
        const canAutoApprove =
          !isMandatory &&
          user.department === dept &&
          (user.role === "approver" || user.role === "admin");

        const [newApproval] = await db.insert(approvals).values({
          requestId: newRequest.id,
          approverId: canAutoApprove ? user.id : null,
          department: dept,
          status: canAutoApprove ? "approved" : "pending",
          isMandatory,
          comments: canAutoApprove ? "Auto-approved: Direct submission by authorized department authority" : null,
          processedAt: canAutoApprove ? new Date() : null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }).returning();

        if (canAutoApprove) {
          await db.insert(auditLogs).values({
            resourceId: newRequest.id,
            resourceType: "purchase_request",
            action: "approver_deduplicated",
            userId: user.id,
            details: { department: dept, reason: "Non-mandatory: direct submission by authority", approvalId: newApproval.id },
            timestamp: new Date(),
          });
        }
      }
    }

    return NextResponse.json(newRequest, { status: 201 });
  } catch (error: any) {
    console.error("[Native API] POST Request Error:", error?.message, error?.stack?.split('\n').slice(0,3).join(' | '));
    require('fs').writeFileSync('last_error.json', JSON.stringify({ message: error?.message, detail: error?.detail, code: error?.code, name: error?.name }, null, 2));
    return NextResponse.json({ error: error?.message || "Internal Server Error", detail: error?.detail || error?.code }, { status: 500 });
  }
}
