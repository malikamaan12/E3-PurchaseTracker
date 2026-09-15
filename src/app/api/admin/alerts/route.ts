import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { AlertsService } from "@/lib/services/AlertsService";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/alerts
 * Lists all system alerts (active, inactive, scheduled).
 * Access: Admin or Super Admin.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "admin" && user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden. Admin access required." }, { status: 403 });
    }

    const alerts = await AlertsService.getAllAlerts();
    return NextResponse.json(alerts);
  } catch (error: any) {
    console.error("[Admin Alerts API] GET Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/alerts
 * Creates or updates a system broadcast alert.
 * Access: Admin or Super Admin.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "admin" && user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden. Admin access required." }, { status: 403 });
    }

    const body = await req.json();
    const { title, message, category, priority, active, linkUrl, linkText, expiresAt, id } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const saved = await AlertsService.saveAlert({
      id,
      title,
      message,
      category,
      priority,
      active,
      linkUrl,
      linkText,
      expiresAt,
      createdBy: user.username || `User #${user.id}`,
    }, user.id);

    return NextResponse.json({ success: true, alert: saved });
  } catch (error: any) {
    console.error("[Admin Alerts API] POST Error:", error);
    return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/alerts
 * Toggles an alert's active status.
 */
export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "admin" && user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden. Admin access required." }, { status: 403 });
    }

    const body = await req.json();
    const { id, active } = body;

    if (!id || typeof active !== "boolean") {
      return NextResponse.json({ error: "ID and active boolean status are required" }, { status: 400 });
    }

    const updated = await AlertsService.toggleAlertActive(id, active, user.id);
    if (!updated) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, alert: updated });
  } catch (error: any) {
    console.error("[Admin Alerts API] PATCH Error:", error);
    return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/alerts
 * Deletes a system alert by ID.
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "admin" && user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden. Admin access required." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Alert ID is required" }, { status: 400 });
    }

    const deleted = await AlertsService.deleteAlert(id, user.id);
    if (!deleted) {
      return NextResponse.json({ error: "Alert not found or already removed" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Alert removed successfully" });
  } catch (error: any) {
    console.error("[Admin Alerts API] DELETE Error:", error);
    return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
  }
}
