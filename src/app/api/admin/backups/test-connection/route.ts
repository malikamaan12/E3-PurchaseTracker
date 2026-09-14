import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { R2Storage } from "@/lib/storage/r2";
import { GoogleDriveStorage } from "@/lib/storage/google-drive";
import { SettingsService } from "@/lib/services/SettingsService";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/backups/test-connection
 * Real-time connectivity and permission verification for institutional vaults.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const role = user?.role?.toLowerCase();
    if (!user || (role !== "admin" && role !== "super_admin")) {
      return NextResponse.json({ error: "Unauthorized. Admin or Super Admin privileges required." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { target = "all", folderId } = body;

    const results: Record<string, any> = {};

    // 1. Cloudflare R2 Check
    if (target === "r2" || target === "all") {
      results.r2 = await R2Storage.testConnection();
    }

    // 2. Google Drive Primary Check
    if (target === "gdrive_primary" || target === "all") {
      const primaryFolder = folderId || (await SettingsService.getSetting("google_drive_folder_primary_id")) || process.env.GOOGLE_DRIVE_FOLDER_PRIMARY_ID;
      results.gdrive_primary = await GoogleDriveStorage.testConnection(primaryFolder);
    }

    // 3. Google Drive Secondary Check
    if (target === "gdrive_secondary" || target === "all") {
      const secondaryFolder = folderId || (await SettingsService.getSetting("google_drive_folder_secondary_id")) || process.env.GOOGLE_DRIVE_FOLDER_SECONDARY_ID;
      results.gdrive_secondary = await GoogleDriveStorage.testConnection(secondaryFolder);
    }

    // Include overall active credentials information
    const driveCreds = await GoogleDriveStorage.getCredentials();
    results.credentialsInfo = {
      r2Configured: Boolean(process.env.R2_ENDPOINT && process.env.R2_ACCESS_KEY_ID),
      gdriveConfigured: Boolean(driveCreds),
      gdriveAuthType: driveCreds?.type || "none",
      gdriveClientEmail: driveCreds?.clientEmail || null,
      gdriveSource: driveCreds?.source || null,
    };

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (error: any) {
    console.error("[BACKUP_TEST_CONNECTION] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to verify connections" }, { status: 500 });
  }
}
