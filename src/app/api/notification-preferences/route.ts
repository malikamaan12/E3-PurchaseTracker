import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { notificationService } from "@/lib/services/NotificationService";

/**
 * GET /api/notification-preferences
 * Fetch notification preferences (master toggle, user email, and granular toggles)
 * for the authenticated user.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const data = await notificationService.getUserNotificationPreferences(user.id);
    return NextResponse.json(data);
  } catch (error) {
    console.error("[Notification Preferences API] GET Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * PUT /api/notification-preferences
 * Bulk update notification preferences (master toggle and/or granular preferences)
 */
export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = await req.json();
    const updated = await notificationService.updateAllPreferences(user.id, body);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("[Notification Preferences API] PUT Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * POST /api/notification-preferences
 * Compatibility alias for PUT
 */
export async function POST(req: NextRequest) {
  return PUT(req);
}
