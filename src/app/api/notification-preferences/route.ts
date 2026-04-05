import { NextRequest, NextResponse } from "next/server";
import { NOTIFICATION_CATEGORIES, NOTIFICATION_TYPES } from "@db/schema";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { notificationService } from "@/lib/services/NotificationService";

/**
 * GET /api/notification-preferences
 * Fetch notification preferences for the authenticated user.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const preferences = await notificationService.getUserNotificationPreferences(user.id);
    return NextResponse.json(preferences);
  } catch (error) {
    console.error("[Notification Preferences API] GET Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
