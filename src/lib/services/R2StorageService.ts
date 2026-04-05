import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { AppError } from "../utils/errors";

const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;

// We check if R2 is configured
// This allows graceful fallback to memory/local file system if missing
export const isR2Configured = Boolean(
  R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_ENDPOINT && R2_BUCKET_NAME
);

const s3Client = isR2Configured 
  ? new S3Client({
      region: "auto",
      endpoint: R2_ENDPOINT!,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID!,
        secretAccessKey: R2_SECRET_ACCESS_KEY!,
      },
    })
  : null;

export class R2StorageService {
  /**
   * Upload a buffer to Cloudflare R2
   */
  async uploadAttachment(buffer: Buffer, originalName: string, mimeType: string): Promise<string> {
    if (!isR2Configured || !s3Client) {
      throw new AppError("R2 Storage is not configured on this environment", 500);
    }
    
    // Create a unique key
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const objectKey = `attachments/${uniqueSuffix}-${encodeURIComponent(originalName)}`;

    try {
      const command = new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: objectKey,
        Body: buffer,
        ContentType: mimeType,
      });

      await s3Client.send(command);
      return objectKey;
    } catch (error: any) {
      console.error("[R2StorageService] Upload Error:", error);
      throw new AppError("Failed to upload file to Cloudflare storage", 500);
    }
  }

  /**
   * Generates a temporary, signed read-only URL for downloading an attachment.
   * This offloads transit bandwidth from Vercel to Cloudflare.
   */
  async getReadPresignedUrl(objectKey: string, expiresInSeconds = 3600): Promise<string> {
    if (!isR2Configured || !s3Client) {
      throw new AppError("R2 Storage is not configured on this environment", 500);
    }

    try {
      const command = new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: objectKey,
      });

      const url = await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
      return url;
    } catch (error: any) {
      console.error("[R2StorageService] Presign Error:", error);
      throw new AppError("Failed to generate secure download link", 500);
    }
  }
}

export const r2Storage = new R2StorageService();
