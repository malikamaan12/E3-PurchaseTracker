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
    const role = user?.role?.toLowerCase();
    if (!user || (role !== "admin" && role !== "super_admin")) {
      return NextResponse.json({ error: "Access denied. Admin or Super Admin role required." }, { status: 403 });
    }

    const { GoogleDriveStorage } = await import("@/lib/storage/google-drive");
    const creds = await GoogleDriveStorage.getCredentials();

    const primary = await SettingsService.getSetting("google_drive_folder_primary_id");
    const secondary = await SettingsService.getSetting("google_drive_folder_secondary_id");
    const dbEmail = await SettingsService.getSetting("google_drive_service_account_email");
    const hasDbJson = Boolean(await SettingsService.getSetting("google_drive_service_account_json"));
    const hasDbKey = Boolean(await SettingsService.getSetting("google_drive_private_key"));

    return NextResponse.json({
      primary: primary || process.env.GOOGLE_DRIVE_FOLDER_PRIMARY_ID || "",
      secondary: secondary || process.env.GOOGLE_DRIVE_FOLDER_SECONDARY_ID || "",
      source: primary ? "database" : "environment",
      credentials: {
        isConfigured: Boolean(creds),
        type: creds?.type || "none",
        source: creds?.source || "none",
        clientEmail: creds?.clientEmail || dbEmail || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "",
        hasServiceAccountJson: hasDbJson || Boolean(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON && process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON !== "{}"),
        hasPrivateKey: hasDbKey || Boolean(process.env.GOOGLE_PRIVATE_KEY),
      }
    });
  } catch (error) {
    console.error("[API_SETTINGS_BACKUP] GET Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/settings/backup
 * Update the Google Drive backup destinations and credentials.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const role = user?.role?.toLowerCase();
    if (!user || (role !== "admin" && role !== "super_admin")) {
      return NextResponse.json({ error: "Access denied. Admin or Super Admin role required." }, { status: 403 });
    }

    const body = await req.json();
    const { 
      primary, 
      secondary, 
      serviceAccountJson, 
      serviceAccountEmail, 
      privateKey 
    } = body;

    // Helper to extract Drive Folder ID from full URLs
    const extractDriveId = (input: string) => {
      if (!input) return "";
      const folderMatch = input.match(/folders\/([a-zA-Z0-9_-]+)/);
      if (folderMatch) return folderMatch[1];
      
      const idMatch = input.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (idMatch) return idMatch[1];

      return input.trim();
    };

    const primaryId = extractDriveId(primary);
    const secondaryId = extractDriveId(secondary);

    if (primaryId !== undefined) {
      await SettingsService.setSetting("google_drive_folder_primary_id", primaryId, user.id);
    }
    if (secondaryId !== undefined) {
      await SettingsService.setSetting("google_drive_folder_secondary_id", secondaryId, user.id);
    }

    // Process Service Account JSON paste if provided
    if (serviceAccountJson && serviceAccountJson.trim() !== "") {
      try {
        const parsed = JSON.parse(serviceAccountJson.trim());
        if (parsed.client_email && (parsed.private_key || parsed.privateKey)) {
          await SettingsService.setSetting("google_drive_service_account_json", JSON.stringify(parsed), user.id);
          await SettingsService.setSetting("google_drive_service_account_email", parsed.client_email, user.id);
          await SettingsService.setSetting("google_drive_private_key", parsed.private_key || parsed.privateKey, user.id);
        } else {
          return NextResponse.json({ error: "Invalid Service Account JSON: must contain client_email and private_key." }, { status: 400 });
        }
      } catch {
        return NextResponse.json({ error: "Invalid JSON format for Service Account key." }, { status: 400 });
      }
    } else {
      // Individual fields
      if (serviceAccountEmail !== undefined && serviceAccountEmail.trim() !== "") {
        await SettingsService.setSetting("google_drive_service_account_email", serviceAccountEmail.trim(), user.id);
      }
      if (privateKey !== undefined && privateKey.trim() !== "" && !privateKey.includes("••••")) {
        await SettingsService.setSetting("google_drive_private_key", privateKey.trim(), user.id);
      }
    }

    const { GoogleDriveStorage } = await import("@/lib/storage/google-drive");
    const creds = await GoogleDriveStorage.getCredentials();

    return NextResponse.json({ 
      success: true, 
      message: "Vault Configuration and Credentials updated successfully.",
      primaryId,
      secondaryId,
      isConfigured: Boolean(creds),
      clientEmail: creds?.clientEmail || null,
    });

  } catch (error) {
    console.error("[API_SETTINGS_BACKUP] POST Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
