import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-next";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/backups/history
 * Fetches the list of recent backups from R2 for the Admin UI.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const role = user?.role?.toLowerCase();
    if (!user || (role !== "admin" && role !== "super_admin")) {
      return NextResponse.json({ error: "Unauthorized. Admin or Super Admin privileges required." }, { status: 403 });
    }

    const { R2Storage } = await import("@/lib/storage/r2");
    const backups = await R2Storage.listBackups();

    return NextResponse.json(backups);
  } catch (error) {
    console.error("[BACKUP_HISTORY_API] Error:", error);
    return NextResponse.json({ error: "Failed to fetch backup history" }, { status: 500 });
  }
}
