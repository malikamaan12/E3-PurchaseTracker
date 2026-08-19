import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { users } from "@db/schema";
import { eq, and } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { NotificationService } from "@/lib/services/NotificationService";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/diagnostics/test-alert
 * Dispatches a simulated crash notification to all Super Admins.
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await getAuthenticatedUser(req);
    if (!admin) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (admin.role !== "super_admin") {
      return NextResponse.json({ error: "Access denied. Super Admin only." }, { status: 403 });
    }

    const superAdmins = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, "super_admin"), eq(users.isActive, true)));

    const notificationService = NotificationService.getInstance();
    const alertTitle = "🧪 Test Crash Alert Verification";
    const alertMessage = `Diagnostic simulation by ${admin.username}. Crash alerting pipeline is 100% operational.`;

    for (const sa of superAdmins) {
      await notificationService.createNotification({
        userId: sa.id,
        title: alertTitle,
        message: alertMessage,
        type: "system_alert",
        priority: "high",
        link: "/dashboard/admin/diagnostics",
        actionType: "view",
        actionData: {
          roleRestrictions: ["super_admin"],
          isSimulation: true,
          testedAt: new Date().toISOString(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      recipients: superAdmins.length,
      message: `Simulated crash alert delivered to ${superAdmins.length} Super Admin(s).`,
    });
  } catch (error: any) {
    console.error("[Test Alert Error]:", error);
    return NextResponse.json({ error: "Test failed", details: error.message }, { status: 500 });
  }
}
