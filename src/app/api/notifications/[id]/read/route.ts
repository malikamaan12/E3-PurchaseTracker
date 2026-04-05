import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { notificationService } from "@/lib/services/NotificationService";

/**
 * PATCH /api/notifications/[id]/read
 * Mark a specific notification as read for the authenticated user.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: paramId } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const notificationId = parseInt(paramId);
    if (isNaN(notificationId)) return NextResponse.json({ error: "Invalid notification ID" }, { status: 400 });

    const updated = await notificationService.markNotificationAsRead(notificationId, user.id);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("[Notifications API] PATCH Read Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
