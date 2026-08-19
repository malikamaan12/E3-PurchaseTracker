import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { notifications } from "@db/schema";
import { and, eq } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { notificationService } from "@/lib/services/NotificationService";

/**
 * GET /api/notifications
 * Fetch notifications for the authenticated user.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const lastFetchTimeStr = searchParams.get("lastFetchTime");
    const lastFetchTime = lastFetchTimeStr ? new Date(lastFetchTimeStr) : undefined;
    const includeRead = searchParams.get("includeRead") !== "false";

    const results = await notificationService.getNotifications(user.id, {
      lastFetchTime,
      includeRead,
      user,
    });

    return NextResponse.json(results);
  } catch (error) {
    console.error("[Notifications API] GET Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
