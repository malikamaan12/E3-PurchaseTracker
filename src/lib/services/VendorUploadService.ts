import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { transactionDb as db } from "@db";
import { vendorUploadIntents, vendorDocuments, vendorOnboardingDrafts, vendorOnboardingTokens } from "@db/schema";
import { eq, and, sql } from "drizzle-orm";
import crypto from "crypto";

const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;

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

// File constraints
export const ALLOWED_UPLOAD_CONFIG = {
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024, // 10 MB per file
  MAX_FILES_PER_INVITATION: 5,
  MAX_CUMULATIVE_BYTES: 30 * 1024 * 1024, // 30 MB total
  ALLOWED_EXTENSIONS: ["pdf", "jpg", "jpeg", "png"],
  ALLOWED_MIME_TYPES: ["application/pdf", "image/jpeg", "image/png"],
  PRESIGNED_UPLOAD_EXPIRY_SECONDS: 300, // 5 minutes
  PRESIGNED_DOWNLOAD_EXPIRY_SECONDS: 900, // 15 minutes
};

// Known magic byte signatures
const MAGIC_BYTES = {
  PDF: Buffer.from([0x25, 0x50, 0x44, 0x46]), // %PDF-
  JPEG: Buffer.from([0xff, 0xd8, 0xff]),
  PNG: Buffer.from([0x89, 0x50, 0x4e, 0x47]), // .PNG
};

export class VendorUploadService {
  private static instance: VendorUploadService;

  private constructor() {}

  public static getInstance(): VendorUploadService {
    if (!VendorUploadService.instance) {
      VendorUploadService.instance = new VendorUploadService();
    }
    return VendorUploadService.instance;
  }

  /**
   * Sanitizes a file name for display metadata
   */
  public sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/\.\.+/g, "")
      .replace(/[^a-zA-Z0-9._\- ]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 150);
  }

  /**
   * Validates extension and MIME type
   */
  public validateFileType(fileName: string, mimeType: string): { valid: boolean; ext: string; error?: string } {
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    
    if (!ALLOWED_UPLOAD_CONFIG.ALLOWED_EXTENSIONS.includes(ext)) {
      return {
        valid: false,
        ext,
        error: `File format .${ext} is not allowed. Only PDF, JPG, and PNG are permitted for security.`,
      };
    }

    if (!ALLOWED_UPLOAD_CONFIG.ALLOWED_MIME_TYPES.includes(mimeType)) {
      return {
        valid: false,
        ext,
        error: `MIME type ${mimeType} is invalid. Only PDF and image uploads are permitted.`,
      };
    }

    return { valid: true, ext };
  }

  /**
   * Initiates an upload intent and generates a direct-to-R2 presigned PUT URL.
   * Uses transactional SELECT ... FOR UPDATE on the draft to prevent race conditions with profile submission.
   */
  public async initiateUploadIntent({
    invitationId,
    draftId,
    vendorId,
    documentType,
    fileName,
    fileSize,
    mimeType,
  }: {
    invitationId: number;
    draftId?: number | null;
    vendorId?: number | null;
    documentType: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  }): Promise<{
    intentId: number;
    uploadUrl: string;
    objectKey: string;
    expiresAt: string;
  }> {
    if (!isR2Configured || !s3Client) {
      throw new Error("Secure Cloudflare R2 storage is not configured on this environment.");
    }

    // 1. Size check
    if (fileSize > ALLOWED_UPLOAD_CONFIG.MAX_FILE_SIZE_BYTES) {
      throw new Error(`File size ${(fileSize / 1024 / 1024).toFixed(1)} MB exceeds the maximum 10 MB limit.`);
    }

    if (fileSize <= 0) {
      throw new Error("Empty or invalid file payload.");
    }

    // 2. Type validation
    const typeCheck = this.validateFileType(fileName, mimeType);
    if (!typeCheck.valid) {
      throw new Error(typeCheck.error);
    }

    // 3. Generate random, unguessable object key
    const randomUuid = crypto.randomUUID();
    const objectKey = `vendor-documents/temp/${invitationId}/${randomUuid}.${typeCheck.ext}`;
    const expiresAt = new Date(Date.now() + ALLOWED_UPLOAD_CONFIG.PRESIGNED_UPLOAD_EXPIRY_SECONDS * 1000);
    const sanitizedName = this.sanitizeFileName(fileName);

    // 4. Atomically lock draft, validate state & quota, and insert intent in a single transaction
    const intent = await db.transaction(async (tx) => {
      if (draftId) {
        // 4a. Acquire exclusive row lock on the draft
        const [lockedDraft] = await tx
          .select()
          .from(vendorOnboardingDrafts)
          .where(eq(vendorOnboardingDrafts.id, draftId))
          .for("update");

        if (!lockedDraft) {
          throw new Error("Draft not found.");
        }

        // 4b. Revalidate draft status: permit only exact allowlisted states
        if (!["in_progress", "changes_requested"].includes(lockedDraft.onboardingStatus)) {
          throw new Error("Uploads are not permitted in the current onboarding state.");
        }

        // 4c. Verify invitation token ownership
        const [token] = await tx
          .select()
          .from(vendorOnboardingTokens)
          .where(and(eq(vendorOnboardingTokens.id, invitationId), eq(vendorOnboardingTokens.draftId, draftId)))
          .limit(1);

        if (!token || token.status !== "active") {
          throw new Error("Invitation session is invalid or no longer active.");
        }
      }

      // 4d. Quota & cumulative size check under lock
      const existingDocs = await tx
        .select({ id: vendorDocuments.id })
        .from(vendorDocuments)
        .where(
          draftId
            ? eq(vendorDocuments.draftId, draftId)
            : vendorId
            ? eq(vendorDocuments.vendorId, vendorId)
            : eq(vendorDocuments.invitationId, invitationId)
        );

      const pendingIntents = await tx
        .select({ id: vendorUploadIntents.id, fileSize: vendorUploadIntents.fileSize })
        .from(vendorUploadIntents)
        .where(
          and(
            eq(vendorUploadIntents.invitationId, invitationId),
            eq(vendorUploadIntents.status, "pending"),
            sql`${vendorUploadIntents.expiresAt} > now()`
          )
        );

      const totalCount = existingDocs.length + pendingIntents.length;
      if (totalCount >= ALLOWED_UPLOAD_CONFIG.MAX_FILES_PER_INVITATION) {
        throw new Error(`Maximum limit of ${ALLOWED_UPLOAD_CONFIG.MAX_FILES_PER_INVITATION} documents reached for this invitation.`);
      }

      const totalBytes = pendingIntents.reduce((acc, i) => acc + (i.fileSize || 0), 0) + fileSize;
      if (totalBytes > ALLOWED_UPLOAD_CONFIG.MAX_CUMULATIVE_BYTES) {
        throw new Error("Cumulative upload size exceeds maximum allowed 30 MB limit.");
      }

      // 4e. Record upload intent durably before releasing the lock
      const [newIntent] = await tx
        .insert(vendorUploadIntents)
        .values({
          invitationId,
          draftId: draftId || null,
          vendorId: vendorId || null,
          objectKey,
          documentType,
          fileName: sanitizedName,
          fileSize,
          mimeType,
          status: "pending",
          expiresAt,
        })
        .returning();

      return newIntent;
    });

    // 5. Generate presigned PUT URL only after intent is durably created
    try {
      const command = new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: objectKey,
        ContentType: mimeType,
      });

      const uploadUrl = await getSignedUrl(s3Client, command, {
        expiresIn: ALLOWED_UPLOAD_CONFIG.PRESIGNED_UPLOAD_EXPIRY_SECONDS,
      });

      return {
        intentId: intent.id,
        uploadUrl,
        objectKey,
        expiresAt: expiresAt.toISOString(),
      };
    } catch (signingErr) {
      const correlationId = crypto.randomUUID();
      console.error(
        `[VendorUploadService][Correlation: ${correlationId}] Presigned URL generation failed for intent ${intent.id}:`,
        signingErr
      );
      // Mark intent cancelled so it cannot block subsequent submission
      await db
        .update(vendorUploadIntents)
        .set({ status: "failed" })
        .where(eq(vendorUploadIntents.id, intent.id));

      throw new Error(
        `Failed to generate secure upload authorization (Correlation ID: ${correlationId}). Please try again.`
      );
    }
  }

  /**
   * Verifies the uploaded object in R2, validates magic bytes, and commits the document record
   */
  public async completeUploadIntent({
    intentId,
    invitationId,
    expiryDate,
  }: {
    intentId: number;
    invitationId: number;
    expiryDate?: string | null;
  }) {
    if (!isR2Configured || !s3Client) {
      throw new Error("Storage service unavailable.");
    }

    // 1. Fetch intent
    const [intent] = await db
      .select()
      .from(vendorUploadIntents)
      .where(and(eq(vendorUploadIntents.id, intentId), eq(vendorUploadIntents.invitationId, invitationId)))
      .limit(1);

    if (!intent) {
      throw new Error("Upload intent not found or unauthorized for this invitation.");
    }

    if (intent.status === "completed") {
      throw new Error("This upload intent has already been finalized.");
    }

    if (new Date() > new Date(intent.expiresAt)) {
      await this.cleanupFailedUpload(intent.objectKey);
      throw new Error("Upload window has expired. Please initiate a new upload.");
    }

    // Check draft status to prevent completing upload after profile submission
    if (intent.draftId) {
      const [currentDraft] = await db
        .select({ onboardingStatus: vendorOnboardingDrafts.onboardingStatus })
        .from(vendorOnboardingDrafts)
        .where(eq(vendorOnboardingDrafts.id, intent.draftId))
        .limit(1);

      if (currentDraft?.onboardingStatus === "submitted" || currentDraft?.onboardingStatus === "approved") {
        await db
          .update(vendorUploadIntents)
          .set({ status: "failed" })
          .where(eq(vendorUploadIntents.id, intent.id));
        throw new Error("Upload finalization is not permitted after the profile has been submitted.");
      }
    }

    try {
      // 2. Verify object exists in R2
      const headCommand = new HeadObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: intent.objectKey,
      });
      const headRes = await s3Client.send(headCommand);

      const actualSize = headRes.ContentLength || 0;
      if (actualSize <= 0) {
        throw new Error("Uploaded file is empty.");
      }

      // Allow small margin of discrepancy but block massive deviation
      if (Math.abs(actualSize - intent.fileSize) > 1024 * 50) {
        throw new Error("Uploaded file size does not match declared intent size.");
      }

      // 3. Inspect leading magic bytes to ensure file signature matches format
      const getCommand = new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: intent.objectKey,
        Range: "bytes=0-15",
      });
      const getRes = await s3Client.send(getCommand);
      const stream = getRes.Body as any;
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      const headerBuffer = Buffer.concat(chunks);

      const isValidSignature = this.verifyMagicBytes(headerBuffer, intent.mimeType);
      if (!isValidSignature) {
        throw new Error("File content signature does not match declared type. Executable or disguised files are blocked.");
      }

      // 4. Mark intent as completed and register vendor_documents
      const [doc] = await db.transaction(async (tx) => {
        if (intent.draftId) {
          const [lockedDraft] = await tx
            .select({ onboardingStatus: vendorOnboardingDrafts.onboardingStatus })
            .from(vendorOnboardingDrafts)
            .where(eq(vendorOnboardingDrafts.id, intent.draftId))
            .for("update");

          if (lockedDraft?.onboardingStatus === "submitted" || lockedDraft?.onboardingStatus === "approved") {
            await tx
              .update(vendorUploadIntents)
              .set({ status: "failed" })
              .where(eq(vendorUploadIntents.id, intent.id));
            throw new Error("Upload finalization is not permitted after the profile has been submitted.");
          }
        }

        await tx
          .update(vendorUploadIntents)
          .set({ status: "completed", completedAt: new Date() })
          .where(eq(vendorUploadIntents.id, intent.id));

        const [newDoc] = await tx
          .insert(vendorDocuments)
          .values({
            vendorId: intent.vendorId || null,
            draftId: intent.draftId || null,
            invitationId: intent.invitationId,
            documentType: intent.documentType,
            documentName: intent.fileName,
            fileUrl: intent.objectKey,
            status: "valid",
            reviewStatus: "pending_review",
            uploadedBySource: "vendor_onboarding",
            expiryDate: expiryDate ? new Date(expiryDate) : null,
          })
          .returning();

        return [newDoc];
      });

      return doc;
    } catch (err: any) {
      // Immediate cleanup of invalid temporary object
      await this.cleanupFailedUpload(intent.objectKey);
      await db
        .update(vendorUploadIntents)
        .set({ status: "failed" })
        .where(eq(vendorUploadIntents.id, intent.id));

      console.error("[VendorUploadService] Upload validation failed:", err);
      throw new Error(err.message || "Failed to verify and commit uploaded document.");
    }
  }

  /**
   * Verifies file signature against expected MIME type
   */
  private verifyMagicBytes(buffer: Buffer, mimeType: string): boolean {
    if (buffer.length < 4) return false;

    if (mimeType === "application/pdf") {
      return buffer.subarray(0, 4).equals(MAGIC_BYTES.PDF);
    }

    if (mimeType === "image/jpeg") {
      return buffer.subarray(0, 3).equals(MAGIC_BYTES.JPEG);
    }

    if (mimeType === "image/png") {
      return buffer.subarray(0, 4).equals(MAGIC_BYTES.PNG);
    }

    return false;
  }

  /**
   * Generates a 15-minute presigned read URL with download disposition
   */
  public async getPresignedDownloadUrl(objectKey: string, fileName: string): Promise<string> {
    if (!isR2Configured || !s3Client) {
      throw new Error("Storage service unavailable.");
    }

    const sanitizedName = this.sanitizeFileName(fileName);
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: objectKey,
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(sanitizedName)}"`,
    });

    return getSignedUrl(s3Client, command, {
      expiresIn: ALLOWED_UPLOAD_CONFIG.PRESIGNED_DOWNLOAD_EXPIRY_SECONDS,
    });
  }

  /**
   * Deletes a draft document owned by the verified invitation
   */
  public async deleteDraftDocument({
    docId,
    invitationId,
    draftId,
  }: {
    docId: number;
    invitationId: number;
    draftId?: number | null;
  }) {
    return await db.transaction(async (tx) => {
      // 1. Verify ownership and draft review status
      const [doc] = await tx
        .select()
        .from(vendorDocuments)
        .where(
          and(
            eq(vendorDocuments.id, docId),
            draftId ? eq(vendorDocuments.draftId, draftId) : eq(vendorDocuments.invitationId, invitationId)
          )
        )
        .limit(1);

      if (!doc) {
        throw new Error("Document not found or access denied.");
      }

      // Draft immutability check: prevent deletion once draft is submitted or approved
      if (doc.draftId) {
        const [lockedDraft] = await tx
          .select({ onboardingStatus: vendorOnboardingDrafts.onboardingStatus })
          .from(vendorOnboardingDrafts)
          .where(eq(vendorOnboardingDrafts.id, doc.draftId))
          .for("update");

        if (lockedDraft?.onboardingStatus === "submitted" || lockedDraft?.onboardingStatus === "approved") {
          throw new Error("Documents cannot be deleted after the profile has been submitted.");
        }
      }

      if (doc.reviewStatus !== "pending_review" && doc.uploadedBySource === "admin") {
        throw new Error("Approved or historical documents cannot be deleted.");
      }

      // 2. Delete from DB
      await tx.delete(vendorDocuments).where(eq(vendorDocuments.id, docId));

      // 3. Delete from R2
      await this.cleanupFailedUpload(doc.fileUrl);

      return { success: true };
    });
  }

  /**
   * Helper to delete an object from R2 safely
   */
  public async cleanupFailedUpload(objectKey: string) {
    if (!isR2Configured || !s3Client || !objectKey) return;
    try {
      const command = new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: objectKey,
      });
      await s3Client.send(command);
    } catch (err) {
      console.warn(`[VendorUploadService] Failed to clean up R2 key ${objectKey}:`, err);
    }
  }
}

export const vendorUploadService = VendorUploadService.getInstance();
