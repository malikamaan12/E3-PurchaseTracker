import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { emailService } from "@/lib/services/EmailService";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/email/test
 * Dispatches a live transactional test email.
 * Access: Admin or Super Admin.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "admin" && user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden. Admin access required." }, { status: 403 });
    }

    const body = await req.json();
    const { to, subject, templateType = "test_verification", customMessage } = body;

    if (!to || typeof to !== "string" || !to.includes("@")) {
      return NextResponse.json({ error: "A valid recipient email address is required" }, { status: 400 });
    }

    const isConfigured = emailService.isConfigured();
    if (!isConfigured) {
      await emailService.ensureConfigured();
      if (!emailService.isConfigured()) {
        return NextResponse.json({
          error: "Email delivery service is not configured. Please enter a valid API key first.",
        }, { status: 400 });
      }
    }

    const now = new Date();
    const formattedTime = now.toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    let emailSubject = subject || "E3 PurchaseTracker • System Test Verification";
    let title = "Email Gateway Delivery Verification";
    let message = customMessage || "This is a verified test email sent from the E3 PurchaseTracker administrative console to confirm transactional delivery.";

    if (templateType === "compliance_alert") {
      emailSubject = subject || "E3 Procurement • Compliance Rule Update";
      title = "Procurement Compliance Policy Updated";
      message = customMessage || "Please review the updated procurement approval thresholds and vendor verification requirements.";
    } else if (templateType === "system_update") {
      emailSubject = subject || "E3 System Update • Platform Notification";
      title = "E3 Platform Update Deployed";
      message = customMessage || "New financial analytics and streamlined purchase order workflows are now live across all departments.";
    }

    const result = await emailService.sendNotificationEmail({
      to: to.trim(),
      userName: user.username || "System Administrator",
      type: templateType,
      title,
      message,
      priority: "normal",
      actionUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://e3-purchase-tracker.vercel.app"}/dashboard`,
      shortcuts: {
        overviewUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://e3-purchase-tracker.vercel.app"}/dashboard/requests`,
      },
    });

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error || "Email delivery failed via gateway",
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      messageId: (result as any).id || (result as any).messageId,
      dispatchedTo: to.trim(),
      dispatchedAt: formattedTime,
      message: `Test email successfully dispatched to ${to.trim()}`,
    });
  } catch (error: any) {
    console.error("[Admin Email Test API] POST Error:", error);
    return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
  }
}
