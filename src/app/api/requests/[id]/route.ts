import { NextRequest, NextResponse } from "next/server";
import { AppError } from "@/lib/utils/errors";
import { db } from "@db";
import { 
  purchaseRequests, 
  users, 
  vendors, 
  subPurposes, 
  approvals, 
  fileAttachments, 
  auditLogs,
  departments 
} from "@db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { notificationService } from "@/lib/services/NotificationService";

export const dynamic = 'force-dynamic';

// GET /api/requests/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    // Fetch related data in parallel for better performance
    const [
      [requester],
      [vendor],
      [subPurpose],
      requestApprovals,
      attachments,
      requestAuditLogs
    ] = await Promise.all([
      db.select().from(users).where(eq(users.id, request.requesterId)).limit(1),
      db.select().from(vendors).where(eq(vendors.id, request.vendorId)).limit(1),
      request.subPurposeId 
        ? db.select().from(subPurposes).where(eq(subPurposes.id, request.subPurposeId)).limit(1)
        : Promise.resolve([null]),
      db.select({
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
      .where(eq(approvals.requestId, requestId)),
      db.select().from(fileAttachments).where(eq(fileAttachments.requestId, requestId)),
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
          eq(auditLogs.resourceType, "purchase_request")
        )
      )
      .orderBy(desc(auditLogs.timestamp))
    ]);

    // Fetch Potential Stakeholders for departments in approval chain
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

    // Parse JSON fields
    let parsedItems = request.items || [];
    try {
      if (typeof request.items === "string") parsedItems = JSON.parse(request.items);
    } catch(e) {}

    let parsedApprovers = request.additionalApprovers || [];
    try {
      if (typeof request.additionalApprovers === "string") parsedApprovers = JSON.parse(request.additionalApprovers);
    } catch(e) {}

    return NextResponse.json({
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
  } catch (error: any) {
    console.error("[Native API] GET Request Detail Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
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

    const updateData = await req.json();

    const [existing] = await db
      .select()
      .from(purchaseRequests)
      .where(eq(purchaseRequests.id, requestId))
      .limit(1);

    if (!existing) return NextResponse.json({ error: "Request not found" }, { status: 404 });
    
    // Check ownership if not admin/approver
    if (existing.requesterId !== user.id && user.role === 'user') {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
    }

    if (existing.isLocked && updateData.status !== "changes_requested") {
      return NextResponse.json({ error: "Request is locked for editing" }, { status: 403 });
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

    // Approval Reset on Edit if previously changes_requested
    const isEditAfterChangesRequested =
      existing.status === "changes_requested" &&
      updateData.status !== "changes_requested" &&
      existing.requesterId === user.id;

    if (isEditAfterChangesRequested) {
      await db.delete(approvals).where(eq(approvals.requestId, requestId));
      cleanData.status = "draft";
      cleanData.isLocked = false;
    }

    const [updated] = await db
      .update(purchaseRequests)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(purchaseRequests.id, requestId))
      .returning();

    // Transition to pending: Create approval records and send notifications
    if (updateData.status === "pending" && (existing.status === "draft" || existing.status === "changes_requested")) {
      // 1. Fetch Mandatory Departments
      const mandatoryDeptRecords = await db.select().from(departments).where(eq(departments.isApprover, true));
      const mandatoryDepts = mandatoryDeptRecords.map(d => d.name);
      
      // 2. Combine with Additional Approvers
      let additionalDepts: string[] = [];
      try {
        if (typeof updated.additionalApprovers === 'string') {
          additionalDepts = JSON.parse(updated.additionalApprovers);
        } else if (Array.isArray(updated.additionalApprovers)) {
          additionalDepts = updated.additionalApprovers;
        }
      } catch (e) {}

      const allRequiredDepts = Array.from(new Set([...mandatoryDepts, ...additionalDepts]));

      // 3. Create Approval Records
      for (const dept of allRequiredDepts) {
        const [existingApproval] = await db
          .select()
          .from(approvals)
          .where(and(eq(approvals.requestId, requestId), eq(approvals.department, dept)))
          .limit(1);

        if (!existingApproval) {
          const requesterIsApproverForThisDept = user.department === dept && user.isApprover === true;

          const [newApproval] = await db.insert(approvals).values({
            requestId,
            approverId: requesterIsApproverForThisDept ? user.id : null,
            department: dept,
            status: requesterIsApproverForThisDept ? "approved" : "pending",
            isMandatory: mandatoryDepts.includes(dept),
            comments: requesterIsApproverForThisDept ? "Auto-approved: Request submitted by department HOD/GM" : null,
            processedAt: requesterIsApproverForThisDept ? new Date() : null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }).returning();

          if (requesterIsApproverForThisDept) {
            await db.insert(auditLogs).values({
              resourceId: requestId,
              resourceType: "purchase_request",
              action: "department_auto_approved",
              userId: user.id,
              details: { department: dept, reason: "Requester is Department Head/Approver", approvalId: newApproval.id },
              timestamp: new Date(),
            });
          }
        }
      }

      // 4. Notifications
      const deptApprovers = await db.select().from(users).where(and(inArray(users.department, allRequiredDepts), eq(users.isActive, true)));
      const adminUsers = await db.select().from(users).where(and(eq(users.role, 'admin'), eq(users.isActive, true)));

      const targetUserIds = new Set<number>();
      deptApprovers.forEach(a => targetUserIds.add(a.id));
      adminUsers.forEach(a => targetUserIds.add(a.id));
      targetUserIds.delete(user.id);

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

      await db.update(purchaseRequests).set({ isLocked: true, updatedAt: new Date() }).where(eq(purchaseRequests.id, requestId));
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("[Native API] PUT Request Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
