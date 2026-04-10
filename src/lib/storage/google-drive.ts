import { google } from "googleapis";
import { Readable } from "stream";

/**
 * Google Drive Storage Integration
 * Uses a Service Account to upload backups to designated folders.
 */
export class GoogleDriveStorage {
  private static async getDriveClient() {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON || "{}"),
      scopes: ["https://www.googleapis.com/auth/drive.file"],
    });

    return google.drive({ version: "v3", auth });
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
    const { SettingsService } = await import("@/lib/services/SettingsService");
    
    // Fetch from Settings first (provided via Admin UI)
    const dbPrimary = await SettingsService.getSetting("google_drive_folder_primary_id");
    const dbSecondary = await SettingsService.getSetting("google_drive_folder_secondary_id");

    const primaryId = dbPrimary || process.env.GOOGLE_DRIVE_FOLDER_PRIMARY_ID;
    const secondaryId = dbSecondary || process.env.GOOGLE_DRIVE_FOLDER_SECONDARY_ID;

    const results = [];
    if (primaryId) {
      console.log(`[DriveStorage] Uploading to Primary Vault: ${primaryId}`);
      results.push(await this.uploadFile(buffer, fileName, primaryId));
    }
    if (secondaryId) {
      console.log(`[DriveStorage] Uploading to Secondary Vault: ${secondaryId}`);
      results.push(await this.uploadFile(buffer, fileName, secondaryId));
    }

    return results;
  }
}
