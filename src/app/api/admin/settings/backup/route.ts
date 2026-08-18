import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { SettingsService } from "@/lib/services/SettingsService";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/settings/backup
 * Fetch the currently configured Google Drive folder IDs.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user || user.role.toLowerCase() !== "super_admin") {
      return NextResponse.json({ error: "Access denied. Super Admin role required." }, { status: 403 });
    }

    const primary = await SettingsService.getSetting("google_drive_folder_primary_id");
    const secondary = await SettingsService.getSetting("google_drive_folder_secondary_id");

    return NextResponse.json({
      primary: primary || process.env.GOOGLE_DRIVE_FOLDER_PRIMARY_ID || "",
      secondary: secondary || process.env.GOOGLE_DRIVE_FOLDER_SECONDARY_ID || "",
      source: primary ? "database" : "environment"
    });
  } catch (error) {
    console.error("[API_SETTINGS_BACKUP] GET Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/settings/backup
 * Update the Google Drive backup destinations.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user || user.role.toLowerCase() !== "super_admin") {
      return NextResponse.json({ error: "Access denied. Super Admin role required." }, { status: 403 });
    }

    const body = await req.json();
    const { primary, secondary } = body;

    // Helper to extract Drive Folder ID from full URLs
    const extractDriveId = (input: string) => {
      if (!input) return "";
      // Match pattern like /folders/1abc... or ?id=1abc...
      const folderMatch = input.match(/folders\/([a-zA-Z0-9_-]+)/);
      if (folderMatch) return folderMatch[1];
      
      const idMatch = input.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (idMatch) return idMatch[1];

      return input.trim(); // Assume it's already an ID
    };

    const primaryId = extractDriveId(primary);
    const secondaryId = extractDriveId(secondary);

    if (primaryId) {
      await SettingsService.setSetting("google_drive_folder_primary_id", primaryId, user.id);
    }
    if (secondaryId) {
      await SettingsService.setSetting("google_drive_folder_secondary_id", secondaryId, user.id);
    }

    return NextResponse.json({ 
      success: true, 
      message: "Vault Configuration updated successfully.",
      primaryId,
      secondaryId
    });

  } catch (error) {
    console.error("[API_SETTINGS_BACKUP] POST Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
