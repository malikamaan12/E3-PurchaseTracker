import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { notifications } from "@db/schema";
import { and, eq, count } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";

export const dynamic = 'force-dynamic';

/**
 * GET /api/notifications/unread-count
 * Returns the count of unread notifications for the current user.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [result] = await db
      .select({ count: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, user.id),
          eq(notifications.isRead, false)
        )
      );

    return NextResponse.json({ count: result.count });
  } catch (error: any) {
    console.error("[Notifications API] Unread Count Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
