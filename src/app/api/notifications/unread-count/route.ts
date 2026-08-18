import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { notifications } from "@db/schema";
import { and, eq, count } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";

import { notificationService } from "@/lib/services/NotificationService";

export const dynamic = 'force-dynamic';

/**
 * GET /api/notifications/unread-count
 * Returns the count of unread notifications for the current user (deduplicated).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const count = await notificationService.getUnreadCount(user.id);
    return NextResponse.json({ count });
  } catch (error: any) {
    console.error("[Notifications API] Unread Count Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
