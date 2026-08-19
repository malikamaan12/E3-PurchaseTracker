import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { errorLogs, notifications, users, auditLogs } from "@db/schema";
import { eq, inArray, and, gte, sql } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { NotificationService } from "@/lib/services/NotificationService";

export const dynamic = "force-dynamic";

// In-memory crash deduplication cache: fingerprint -> timestamp
const crashDeduplicationMap = new Map<string, number>();

/**
 * POST /api/admin/diagnostics/report-crash
 * Universal intake for frontend and backend unhandled crashes.
 * Automatically logs to error_logs, audit_logs, and dispatches high-priority
 * alert notifications to all active Super Admins.
 */
export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req).catch(() => null);
    const body = await req.json().catch(() => ({}));

    const message = (body.message || "Unknown Application Crash").slice(0, 1000);
    const stack = (body.stack || body.componentStack || "").slice(0, 5000);
    const route = (body.url || body.route || req.headers.get("referer") || "/").slice(0, 500);
    const digest = body.digest || null;
    const severity = body.severity || "critical";
    const userAgent = req.headers.get("user-agent") || body.userAgent || "Unknown";
    const ipAddress = req.headers.get("x-forwarded-for") || "127.0.0.1";

    const fingerprint = `${route}:${message.slice(0, 100)}`;
    const now = Date.now();
    const lastReported = crashDeduplicationMap.get(fingerprint) || 0;

    // Persist to error_logs
    const [insertedError] = await db
      .insert(errorLogs)
      .values({
        message,
        code: digest ? `DIGEST_${digest}` : "CLIENT_RENDER_CRASH",
        severity,
        path: route,
        userId: authUser?.id || null,
        details: {
          stack,
          digest,
          userAgent,
          ipAddress,
          reportedBy: authUser ? { id: authUser.id, username: authUser.username } : "Anonymous Client",
          timestamp: new Date().toISOString(),
        } as any,
      })
      .returning({ id: errorLogs.id });

    // Also log to auditLogs for timeline traceability
    await db.insert(auditLogs).values({
      userId: authUser?.id || null,
      action: "SYSTEM_CRASH_REPORTED",
      resourceType: "error_log",
      resourceId: insertedError?.id || null,
      details: {
        message,
        route,
        severity,
        errorLogId: insertedError?.id,
      },
      ipAddress,
      userAgent,
    }).catch(err => console.error("[Crash Intake] Audit log write failed:", err));

    // Deduplicate notifications to Super Admins (maximum 1 notification per unique crash signature every 3 minutes)
    const isDuplicate = now - lastReported < 3 * 60 * 1000;

    if (!isDuplicate) {
      crashDeduplicationMap.set(fingerprint, now);

      // Clean up old entries in deduplication map
      if (crashDeduplicationMap.size > 200) {
        for (const [key, time] of crashDeduplicationMap.entries()) {
          if (now - time > 10 * 60 * 1000) crashDeduplicationMap.delete(key);
        }
      }

      // Query all active super admins
      const superAdmins = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.role, "super_admin"), eq(users.isActive, true)));

      if (superAdmins.length > 0) {
        const notificationService = NotificationService.getInstance();
        const alertTitle = `🚨 System Crash Alert: ${message.slice(0, 45)}...`;
        const alertMessage = `Crash detected on ${route}. Error: ${message.slice(0, 150)}. Incident Log #${insertedError?.id || "N/A"}`;

        for (const admin of superAdmins) {
          await notificationService.createNotification({
            userId: admin.id,
            title: alertTitle,
            message: alertMessage,
            type: "system_alert",
            priority: "high",
            link: "/dashboard/admin/diagnostics",
            actionType: "view",
            actionData: {
              roleRestrictions: ["super_admin"],
              errorLogId: insertedError?.id,
              route,
              reportedAt: new Date().toISOString(),
            },
          }).catch(err => console.error(`[Crash Alert] Failed notifying admin ${admin.id}:`, err));
        }
      }
    }

    return NextResponse.json({
      success: true,
      incidentId: insertedError?.id,
      superAdminNotified: !isDuplicate,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[Crash Intake API Error]:", error);
    return NextResponse.json(
      { error: "Failed to record crash report", details: error.message },
      { status: 500 }
    );
  }
}
