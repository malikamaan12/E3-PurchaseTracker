import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { emailService } from "@/lib/services/EmailService";
import { SettingsService } from "@/lib/services/SettingsService";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/email/config
 * Retrieves transactional email configuration, delivery gateway status, and global policy.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "admin" && user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden. Admin access required." }, { status: 403 });
    }

    const gatewayStatus = await emailService.getStatus();
    const masterEmailEnabled = await SettingsService.getSetting<boolean>("master_email_enabled");

    return NextResponse.json({
      ...gatewayStatus,
      masterEmailEnabled: masterEmailEnabled !== null ? masterEmailEnabled : true,
    });
  } catch (error: any) {
    console.error("[Admin Email Config API] GET Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/email/config
 * Updates email gateway credentials and master delivery switch.
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
    const { apiKey, fromEmail, masterEmailEnabled } = body;

    // Update master killswitch if provided
    if (typeof masterEmailEnabled === "boolean") {
      await SettingsService.setSetting("master_email_enabled", masterEmailEnabled, user.id);
    }

    // Update API Key & Sender Email if provided
    if (apiKey && typeof apiKey === "string" && apiKey.trim().length > 0) {
      const verifyResult = await emailService.verifyAndConnect(
        apiKey.trim(),
        fromEmail ? fromEmail.trim() : undefined,
        user.id
      );

      if (!verifyResult.success) {
        return NextResponse.json({
          success: false,
          error: verifyResult.error || "Failed to verify email API credentials",
        }, { status: 400 });
      }
    } else if (fromEmail && typeof fromEmail === "string" && fromEmail.trim().length > 0) {
      await SettingsService.setSetting("resend_from_email", fromEmail.trim(), user.id);
    }

    const updatedStatus = await emailService.getStatus();
    const currentMaster = await SettingsService.getSetting<boolean>("master_email_enabled");

    return NextResponse.json({
      success: true,
      message: "Email settings updated successfully",
      config: {
        ...updatedStatus,
        masterEmailEnabled: currentMaster !== null ? currentMaster : true,
      },
    });
  } catch (error: any) {
    console.error("[Admin Email Config API] POST Error:", error);
    return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
  }
}
