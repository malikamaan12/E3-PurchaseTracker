import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { rateLimitBuckets, vendorOnboardingDrafts, auditLogs } from "@db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/diagnostics/purge-cache
 * Self-healing repair action:
 * - Clears transient rate limit locks
 * - Resets stale/stuck vendor onboarding approval claims older than 15 minutes
 * - Logs the self-healing maintenance action
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await getAuthenticatedUser(req);
    if (!admin) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (admin.role !== "super_admin") {
      return NextResponse.json({ error: "Access denied. Super Admin only." }, { status: 403 });
    }

    // 1. Purge expired rate-limit buckets
    const deletedBuckets = await db.delete(rateLimitBuckets);

    // 2. Unblock any stuck vendor onboarding claims older than 15 minutes
    const staleClaimsResult = await db
      .update(vendorOnboardingDrafts)
      .set({
        approvalAttemptId: null,
        approvalProcessingStatus: null,
        approvalProcessingStartedAt: null,
      })
      .where(
        and(
          eq(vendorOnboardingDrafts.approvalProcessingStatus, "processing"),
          sql`${vendorOnboardingDrafts.approvalProcessingStartedAt} < NOW() - INTERVAL '15 minutes'`
        )
      );

    // 3. Log the maintenance action
    await db.insert(auditLogs).values({
      userId: admin.id,
      action: "ADMIN_SYSTEM_PURGE_AND_HEAL",
      resourceType: "system",
      details: {
        performedBy: admin.username,
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "System self-healing completed: transient rate limits purged and stale locks cleared.",
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[Diagnostics Purge Error]:", error);
    return NextResponse.json({ error: "Purge failed", details: error.message }, { status: 500 });
  }
}
