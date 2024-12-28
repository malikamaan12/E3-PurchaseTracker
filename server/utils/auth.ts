import { db } from "@db";
import { users, approvals, purchaseRequests } from "@db/schema";
import { eq } from "drizzle-orm";

export const mandatoryDepartments = ["Finance", "CEO Office", "Director"];

export async function canUserApprove(userId: number, requestId: number): Promise<boolean> {
  try {
    // Get user details
    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return false;
    }

    // Get request details
    const [request] = await db.select()
      .from(purchaseRequests)
      .where(eq(purchaseRequests.id, requestId))
      .limit(1);

    if (!request) {
      return false;
    }

    // Check if user is admin or from mandatory departments
    if (user.role === 'admin' || mandatoryDepartments.includes(user.department)) {
      // Check if they haven't already approved
      const [existingApproval] = await db.select()
        .from(approvals)
        .where(eq(approvals.approverId, userId))
        .where(eq(approvals.requestId, requestId))
        .limit(1);

      return !existingApproval;
    }

    return false;
  } catch (error) {
    console.error("Error checking user approval rights:", error);
    return false;
  }
}
