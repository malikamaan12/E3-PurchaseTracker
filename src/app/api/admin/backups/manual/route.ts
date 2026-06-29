import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { BackupService } from "@/lib/services/BackupService";
import { waitUntil } from "@vercel/functions";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/backups/manual
 * Triggers an immediate institutional data export and background cloud sync.
 * Returns 202 Accepted to avoid Vercel timeouts.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Auth Guard (Admin Only)
    const user = await getAuthenticatedUser(req);
    if (!user || user.role.toLowerCase() !== "admin") {
      return NextResponse.json({ error: "Institutional Backup rights required" }, { status: 403 });
    }

    // 2. Schedule Background Job (Vercel Timeout Bypass)
    // waitUntil ensures the process continues even after the response is sent.
    waitUntil(
      BackupService.runBackupJob(true)
        .then(() => console.log("[API_BACKUP] Background manual job successful"))
        .catch((err) => console.error("[API_BACKUP] Background manual job FAILED:", err))
    );

    // 3. Immedate Acknowledgement
    return NextResponse.json({ 
      message: "Backup processing initiated in the background vault.",
      status: "processing",
      timestamp: new Date().toISOString()
    }, { status: 202 });

  } catch (error: any) {
    console.error("[BACKUP_MANUAL_API] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

