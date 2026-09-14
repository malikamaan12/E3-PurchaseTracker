import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { emailService } from "@/lib/services/EmailService";
import { db } from "@db";
import { users } from "@db/schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/notification-preferences/test-email
 * Sends a test email to the authenticated user's address via Resend.
 */
export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const [user] = await db
      .select({ id: users.id, email: users.email, username: users.username })
      .from(users)
      .where(eq(users.id, authUser.id))
      .limit(1);

    if (!user || !user.email) {
      return NextResponse.json({ error: "User has no email address configured" }, { status: 400 });
    }

    const result = await emailService.sendTestEmail(user.email, user.username);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error || "Failed to send test email"
      }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      message: `Test email sent to ${user.email}`,
      id: result.id,
      simulated: !emailService.isConfigured()
    });
  } catch (error: any) {
    console.error("[Test Email API] POST Error:", error);
    return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
  }
}
