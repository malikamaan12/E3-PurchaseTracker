import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { notifications } from "@db/schema";
import { and, eq } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/notifications/mark-all-read
 * Mark all unread notifications as read for the authenticated user.
 */
export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    await db
      .update(notifications)
      .set({
        isRead: true,
        updatedAt: new Date()
      })
      .where(and(
        eq(notifications.userId, user.id),
        eq(notifications.isRead, false)
      ));

    return NextResponse.json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    console.error("[Notifications API] PATCH Mark All Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
