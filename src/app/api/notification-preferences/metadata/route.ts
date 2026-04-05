import { NextResponse } from "next/server";
import { NOTIFICATION_CATEGORIES, NOTIFICATION_TYPES } from "@db/schema";
import { getAuthenticatedUser } from "@/lib/auth-next";

/**
 * GET /api/notification-preferences/metadata
 * Fetch categories and types for preferences UI.
 */
export async function GET(req: any) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    return NextResponse.json({
      categories: NOTIFICATION_CATEGORIES,
      types: NOTIFICATION_TYPES
    });
  } catch (error) {
    console.error("[Notification Preferences API] Metadata GET Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
