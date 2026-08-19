import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { vendorComplianceCases, vendors, notifications, users, auditLogs } from "@db/schema";
import { eq, and, sql, lte, inArray, isNull } from "drizzle-orm";
import { ComplianceEvaluationService } from "@/lib/services/ComplianceEvaluationService";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/vendor-compliance
 * Automated cron job for evaluating compliance statuses, identifying expiring cases,
 * and dispatching idempotent reminders.
 */
export async function GET(req: NextRequest) {
  try {
    // 1. Bearer Token Authentication (Fail closed if secret is missing in production)
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (process.env.NODE_ENV === "production" && !cronSecret) {
      console.error("[CRON] Security Hard Stop: CRON_SECRET is not configured in production. Rejecting execution.");
      return NextResponse.json({ error: "CRON_SECRET must be configured in production." }, { status: 500 });
    }

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 });
    }

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // 2. Fetch all active compliance cases eligible for reminder (not reminded in last 24h)
    const openCases = await db
      .select({
        caseRecord: vendorComplianceCases,
        vendor: vendors,
      })
      .from(vendorComplianceCases)
      .innerJoin(vendors, eq(vendorComplianceCases.vendorId, vendors.id))
      .where(and(
        inArray(vendorComplianceCases.status, ["open", "under_review"]),
        sql`(${vendorComplianceCases.lastReminderSentAt} IS NULL OR ${vendorComplianceCases.lastReminderSentAt} <= ${twentyFourHoursAgo})`
      ));

    const processedCases: any[] = [];

    for (const item of openCases) {
      const { caseRecord, vendor } = item;
      const deadline = new Date(caseRecord.deadline);
      const daysUntilDeadline = Math.ceil((deadline.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

      // Re-evaluate vendor compliance
      await ComplianceEvaluationService.evaluateVendor(vendor.id);

      // If overdue, update case status
      if (daysUntilDeadline < 0 && caseRecord.status === "open") {
        await db.update(vendorComplianceCases)
          .set({ status: "expired_non_compliant", updatedAt: now })
          .where(eq(vendorComplianceCases.id, caseRecord.id));
      }

      // Mark reminder sent timestamp (Idempotency guarantee)
      await db.update(vendorComplianceCases)
        .set({ 
          lastReminderSentAt: now, 
          reminderCount: sql`${vendorComplianceCases.reminderCount} + 1`,
          updatedAt: now 
        })
        .where(eq(vendorComplianceCases.id, caseRecord.id));

      // Audit log for delivery record
      await db.insert(auditLogs).values({
        resourceType: "vendor_compliance_case",
        resourceId: caseRecord.id,
        action: "COMPLIANCE_REMINDER_DISPATCHED",
        userId: 1, // System automated executor
        details: {
          vendorId: vendor.id,
          vendorEmail: vendor.email,
          caseNumber: caseRecord.caseNumber,
          daysUntilDeadline,
          status: caseRecord.status,
          dispatchedAt: now.toISOString(),
        },
      });

      processedCases.push({
        caseId: caseRecord.id,
        caseNumber: caseRecord.caseNumber,
        vendorName: vendor.companyName,
        daysUntilDeadline,
        status: caseRecord.status,
      });
    }

    // 3. Notify Admin Users about processed cases
    if (processedCases.length > 0) {
      const adminUsers = await db
        .select()
        .from(users)
        .where(inArray(users.role, ["admin", "super_admin"]));

      for (const admin of adminUsers) {
        await db.insert(notifications).values({
          userId: admin.id,
          title: "Vendor Compliance Audit Update",
          message: `${processedCases.length} vendor compliance case(s) evaluated and processed by daily cron.`,
          type: "COMPLIANCE_REMINDER",
          priority: "normal",
        });
      }
    }

    return NextResponse.json({
      success: true,
      processedCount: processedCases.length,
      cases: processedCases,
      timestamp: now.toISOString(),
    });
  } catch (error: any) {
    console.error("[GET /api/cron/vendor-compliance] Cron Error:", error);
    return NextResponse.json({ error: error.message || "Vendor compliance cron failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
