import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { emailService } from "@/lib/services/EmailService";

/**
 * GET /api/admin/resend
 * Check Resend integration status and masked credentials.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const status = await emailService.getStatus();
    return NextResponse.json(status);
  } catch (error: any) {
    console.error("[Resend Admin API] GET Status Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/resend
 * Verify and connect a Resend API key and sender address.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (user.role !== "admin" && user.role !== "super_admin") {
      return NextResponse.json({ error: "Access denied. Administrator privileges required." }, { status: 403 });
    }

    const body = await req.json();
    const { apiKey, fromEmail } = body;

    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json({ error: "Resend API key is required" }, { status: 400 });
    }

    const result = await emailService.verifyAndConnect(apiKey, fromEmail, user.id);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error || "Failed to verify Resend API key"
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: result.message
    });
  } catch (error: any) {
    console.error("[Resend Admin API] POST Connect Error:", error);
    return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
  }
}
