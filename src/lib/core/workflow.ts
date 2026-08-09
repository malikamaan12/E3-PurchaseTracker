import { db } from "@db";
import { approvals, auditLogs } from "@db/schema";
import { eq, and } from "drizzle-orm";

/**
 * PROPRIETARY INTELLECTUAL PROPERTY
 * Approval State Machine and Mandatory Gatekeeper Logic
 */
export const MANDATORY_DEPARTMENTS = ["Management", "Finance", "CEO Office"];

/**
 * Seeds initial approval rows for a new purchase request transitioning to 'pending'.
 * Ensures mandatory gatekeepers are present and handles auto-approval for authorized requesters on non-mandatory steps.
 */
export async function seedInitialApprovals(
  requestId: number,
  userId: number,
  userDepartment: string,
  userRole: string,
  additionalApproversRaw: any
): Promise<void> {
  let additionalDepts: string[] = [];
  try {
    if (typeof additionalApproversRaw === 'string') {
      additionalDepts = JSON.parse(additionalApproversRaw);
    } else if (Array.isArray(additionalApproversRaw)) {
      additionalDepts = additionalApproversRaw;
    }
  } catch (e: any) {}

  // Filter out any overlap with mandatory departments
  const filteredAdditional = additionalDepts.filter(d => !MANDATORY_DEPARTMENTS.includes(d));
  const allRequiredDepts = [...filteredAdditional, ...MANDATORY_DEPARTMENTS];

  for (const dept of allRequiredDepts) {
    const [existingApproval] = await db
      .select()
      .from(approvals)
      .where(and(eq(approvals.requestId, requestId), eq(approvals.department, dept)))
      .limit(1);

    if (!existingApproval) {
      const isMandatory = MANDATORY_DEPARTMENTS.includes(dept);

      // Auto-approval is ONLY allowed for non-mandatory (additional) approver steps
      // where the requester has authority in that specific department.
      const canAutoApprove =
        !isMandatory &&
        userDepartment === dept &&
        (userRole === 'approver' || userRole === 'admin');

      const [newApproval] = await db.insert(approvals).values({
        requestId,
        approverId: canAutoApprove ? userId : null,
        department: dept,
        status: canAutoApprove ? "approved" : "pending",
        isMandatory,
        comments: canAutoApprove ? "Auto-approved: Request submitted by authorized department authority" : null,
        processedAt: canAutoApprove ? new Date() : null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      if (canAutoApprove) {
        await db.insert(auditLogs).values({
          resourceId: requestId,
          resourceType: "purchase_request",
          action: "approver_deduplicated",
          userId: userId,
          details: {
            department: dept,
            reason: "Non-mandatory step: requester has authority for this stage",
            approvalId: newApproval.id
          },
          timestamp: new Date(),
        });
      }
    }
  }
}
