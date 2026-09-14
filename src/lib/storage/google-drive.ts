import { google } from "googleapis";
import { Readable } from "stream";

/**
 * Google Drive Storage Integration
 * Uses a Service Account to upload backups to designated folders.
 */
export class GoogleDriveStorage {
  /**
   * Resolves Google Drive authentication credentials from DB settings first, then Environment variables.
   */
  public static async getCredentials() {
    const { SettingsService } = await import("@/lib/services/SettingsService");

    const dbJson = await SettingsService.getSetting("google_drive_service_account_json");
    const dbEmail = await SettingsService.getSetting("google_drive_service_account_email");
    const dbKey = await SettingsService.getSetting("google_drive_private_key");
    const dbClientId = await SettingsService.getSetting("google_drive_client_id");
    const dbClientSecret = await SettingsService.getSetting("google_drive_client_secret");
    const dbRefreshToken = await SettingsService.getSetting("google_drive_refresh_token");

    const rawJson = dbJson || process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;
    const email = dbEmail || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const key = dbKey || process.env.GOOGLE_PRIVATE_KEY;
    const clientId = dbClientId || process.env.GOOGLE_DRIVE_CLIENT_ID;
    const clientSecret = dbClientSecret || process.env.GOOGLE_DRIVE_CLIENT_SECRET;
    const refreshToken = dbRefreshToken || process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

    // 1. Service Account JSON
    if (rawJson) {
      try {
        const parsed = typeof rawJson === "string" ? (rawJson.trim() !== "" ? JSON.parse(rawJson) : null) : rawJson;
        if (parsed && typeof parsed === "object" && parsed.client_email && (parsed.private_key || parsed.privateKey)) {
          return {
            type: "service_account_json" as const,
            source: dbJson ? "database" : "environment",
            clientEmail: parsed.client_email,
            credentials: {
              client_email: parsed.client_email,
              private_key: (parsed.private_key || parsed.privateKey).replace(/\\n/g, "\n"),
            },
          };
        }
      } catch (err) {
        console.warn("[DriveStorage] Failed to parse Service Account JSON:", err);
      }
    }

    // 2. Service Account Email + Private Key
    if (email && key) {
      return {
        type: "service_account_keys" as const,
        source: dbEmail || dbKey ? "database" : "environment",
        clientEmail: email,
        credentials: {
          client_email: email,
          private_key: key.replace(/\\n/g, "\n"),
        },
      };
    }

    // 3. OAuth2 Client with Refresh Token (non-mock)
    if (clientId && clientSecret && refreshToken && !clientId.includes("mock-") && !refreshToken.includes("mock-")) {
      return {
        type: "oauth2" as const,
        source: dbClientId ? "database" : "environment",
        clientEmail: clientId,
        oauth: { clientId, clientSecret, refreshToken },
      };
    }

    return null;
  }

  public static async getDriveClient() {
    const creds = await this.getCredentials();
    if (!creds) {
      return null;
    }

    if (creds.type === "service_account_json" || creds.type === "service_account_keys") {
      const auth = new google.auth.GoogleAuth({
        credentials: creds.credentials,
        scopes: ["https://www.googleapis.com/auth/drive.file"],
      });
      return google.drive({ version: "v3", auth });
    }

    if (creds.type === "oauth2" && creds.oauth) {
      const oauth2Client = new google.auth.OAuth2(
        creds.oauth.clientId,
        creds.oauth.clientSecret
      );
      oauth2Client.setCredentials({ refresh_token: creds.oauth.refreshToken });
      return google.drive({ version: "v3", auth: oauth2Client });
    }

    return null;
  }

  /**
   * Uploads a file buffer to a specific Google Drive folder.
   */
  static async uploadFile(buffer: Buffer, fileName: string, folderId: string) {
    if (!folderId) {
      console.warn(`[DriveStorage] Skipping upload: No Folder ID provided.`);
      return null;
    }

    try {
      const drive = await this.getDriveClient();
      if (!drive) {
        console.warn(`[DriveStorage] Skipping upload to folder ${folderId}: Google Drive service account credentials are not configured or invalid.`);
        return null;
      }

      const fileMetadata = {
        name: fileName,
        parents: [folderId],
      };

      const media = {
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        body: Readable.from(buffer),
      };

      const response = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: "id",
      });

      console.log(`[DriveStorage] Successfully uploaded to folder ${folderId}:`, response.data.id);
      return response.data.id;
    } catch (error) {
      console.error(`[DriveStorage] Failed to upload to folder ${folderId}:`, error);
      throw error;
    }
  }

  /**
   * Orchestrates the dual-folder redundant upload.
   * Prioritizes Database-configured IDs over Environment Variables.
   */
  static async uploadRedundant(buffer: Buffer, fileName: string) {
    const drive = await this.getDriveClient();
    if (!drive) {
      console.warn("[DriveStorage] Google Drive credentials not configured. Skipping dual-folder redundancy sync.");
      return [];
    }

    const { SettingsService } = await import("@/lib/services/SettingsService");
    
    // Fetch from Settings first (provided via Admin UI)
    const dbPrimary = await SettingsService.getSetting("google_drive_folder_primary_id");
    const dbSecondary = await SettingsService.getSetting("google_drive_folder_secondary_id");

    const primaryId = dbPrimary || process.env.GOOGLE_DRIVE_FOLDER_PRIMARY_ID;
    const secondaryId = dbSecondary || process.env.GOOGLE_DRIVE_FOLDER_SECONDARY_ID;

    const results = [];
    if (primaryId) {
      try {
        console.log(`[DriveStorage] Uploading to Primary Vault: ${primaryId}`);
        const res = await this.uploadFile(buffer, fileName, primaryId);
        if (res) results.push(res);
      } catch (err: any) {
        console.error(`[DriveStorage] Primary Vault upload failed:`, err.message || err);
      }
    }
    if (secondaryId) {
      try {
        console.log(`[DriveStorage] Uploading to Secondary Vault: ${secondaryId}`);
        const res = await this.uploadFile(buffer, fileName, secondaryId);
        if (res) results.push(res);
      } catch (err: any) {
        console.error(`[DriveStorage] Secondary Vault upload failed:`, err.message || err);
      }
    }

    return results;
  }

  /**
   * Tests connectivity and folder write access for Google Drive.
   */
  static async testConnection(folderId?: string) {
    const creds = await this.getCredentials();
    if (!creds) {
      return {
        ok: false,
        error: "Google Drive credentials not configured. Please supply a Google Service Account or OAuth credentials.",
        configured: false,
      };
    }

    try {
      const drive = await this.getDriveClient();
      if (!drive) {
        return {
          ok: false,
          error: "Failed to initialize Google Drive client with provided credentials.",
          configured: false,
        };
      }

      if (folderId) {
        try {
          const res = await drive.files.get({
            fileId: folderId,
            fields: "id, name, mimeType, capabilities, trashed",
            supportsAllDrives: true,
          });

          if (res.data.trashed) {
            return {
              ok: false,
              configured: true,
              folderId,
              error: `Target folder ("${res.data.name}") is in the trash. Please restore it or select another folder.`,
            };
          }

          if (res.data.capabilities && !res.data.capabilities.canAddChildren) {
            return {
              ok: false,
              configured: true,
              folderId,
              folderName: res.data.name,
              error: `Folder "${res.data.name}" found, but Service Account (${creds.clientEmail}) does NOT have Write/Edit permissions. Please share the folder with Editor permissions.`,
            };
          }

          return {
            ok: true,
            configured: true,
            folderId,
            folderName: res.data.name,
            clientEmail: creds.clientEmail,
            message: `Successfully verified write access to folder "${res.data.name}".`,
          };
        } catch (folderErr: any) {
          return {
            ok: false,
            configured: true,
            folderId,
            clientEmail: creds.clientEmail,
            error: folderErr.message?.includes("File not found") 
              ? `Folder not found or not shared with "${creds.clientEmail}". Please ensure the folder is shared with Editor permissions.`
              : folderErr.message || "Failed to inspect target folder.",
          };
        }
      }

      // General connectivity check
      const about = await drive.about.get({ fields: "user(displayName, emailAddress)" });
      return {
        ok: true,
        configured: true,
        clientEmail: creds.clientEmail,
        user: about.data.user,
        message: `Google Drive connection authenticated successfully (${creds.clientEmail}).`,
      };
    } catch (err: any) {
      return {
        ok: false,
        configured: true,
        clientEmail: creds.clientEmail,
        error: err.message || "Google Drive authentication failed.",
      };
    }
  }
}
