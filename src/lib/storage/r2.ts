import { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Cloudflare R2 Client Configuration
 * Uses the AWS S3 SDK with a custom endpoint.
 */
const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT || "", // e.g., https://<accountid>.r2.cloudflarestorage.com
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME || "purchasetracker-backups";

export class R2Storage {
  /**
   * Uploads a backup buffer to the R2 bucket.
   */
  static async uploadBackup(buffer: Buffer, fileName: string, contentType: string = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `backups/${fileName}`,
      Body: buffer,
      ContentType: contentType,
    });

    return r2Client.send(command);
  }

  /**
   * Lists recent backups for the Admin UI.
   */
  static async listBackups() {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: "backups/",
    });

    const response = await r2Client.send(command);
    return response.Contents?.map(obj => ({
      key: obj.Key,
      name: obj.Key?.replace("backups/", ""),
      size: obj.Size,
      lastModified: obj.LastModified,
    })).sort((a, b) => (b.lastModified?.getTime() || 0) - (a.lastModified?.getTime() || 0)) || [];
  }

  /**
   * Generates a signed URL for secure institutional download.
   */
  static async getDownloadUrl(key: string) {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    return getSignedUrl(r2Client, command, { expiresIn: 3600 });
  }
}
