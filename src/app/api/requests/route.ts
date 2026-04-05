import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { purchaseRequests, users, fileAttachments } from "@db/schema";
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
    // - admin/approver: can see filtered list (usually all)
    // - user: can see all requests from THEIR DEPARTMENT
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
      items,
      additionalApprovers,
      attachmentIds
    } = body;

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
        requesterId: user.id,
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

    return NextResponse.json(newRequest, { status: 201 });
  } catch (error: any) {
    console.error("[Native API] POST Request Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
