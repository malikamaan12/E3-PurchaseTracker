import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { AlertsService } from "@/lib/services/AlertsService";

export const dynamic = "force-dynamic";

/**
 * GET /api/alerts/active
 * Returns currently active system alerts for the user dashboard ticker.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const activeAlerts = await AlertsService.getActiveAlerts();
    return NextResponse.json(activeAlerts);
  } catch (error: any) {
    console.error("[Alerts API] GET Active Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
