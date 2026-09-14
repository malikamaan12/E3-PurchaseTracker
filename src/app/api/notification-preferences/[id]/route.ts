import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { notificationService } from "@/lib/services/NotificationService";

/**
 * PATCH /api/notification-preferences/[id]
 * Update a specific notification preference for the authenticated user.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const preferenceId = parseInt(id);
    if (isNaN(preferenceId)) return NextResponse.json({ error: "Invalid preference ID" }, { status: 400 });

    const body = await req.json();
    const updated = await notificationService.updateNotificationPreference(preferenceId, user.id, body);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("[Notification Preferences API] PATCH Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * POST /api/notification-preferences/[id]
 * Compatibility alias for PATCH
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return PATCH(req, context);
}
