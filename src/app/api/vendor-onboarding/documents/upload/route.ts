import { NextRequest, NextResponse } from "next/server";
import { getVendorSession, attachVendorSecurityHeaders } from "@/lib/vendor-auth";
import { r2Storage, isR2Configured } from "@/lib/services/R2StorageService";
import { db } from "@db";
import { vendorDocuments, vendorOnboardingDrafts } from "@db/schema";
import { eq } from "drizzle-orm";
import { complianceService } from "@/lib/services/ComplianceService";
import crypto from "crypto";

export const maxDuration = 60;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_EXTENSIONS = ["pdf", "jpg", "jpeg", "png"];
const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(req: NextRequest) {
  try {
    const session = await getVendorSession(req);

    if (session.isReadOnly) {
      const res = NextResponse.json(
        { error: "This profile has already been submitted and cannot accept new documents." },
        { status: 403 }
      );
      return attachVendorSecurityHeaders(res);
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const documentType = (formData.get("documentType") as string) || "Commercial Registration";
    const expiryDateStr = formData.get("expiryDate") as string | null;

    if (!file) {
      const res = NextResponse.json(
        { error: "No file was selected for upload." },
        { status: 400 }
      );
      return attachVendorSecurityHeaders(res);
    }

    // 1. Extension & MIME validation
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      const res = NextResponse.json(
        { error: `File format .${ext} is not allowed. Only PDF, JPG, and PNG documents are supported.` },
        { status: 400 }
      );
      return attachVendorSecurityHeaders(res);
    }

    // 2. Size validation
    if (file.size > MAX_FILE_SIZE) {
      const res = NextResponse.json(
        { error: `File size ${(file.size / 1024 / 1024).toFixed(1)} MB exceeds the maximum 10 MB limit.` },
        { status: 400 }
      );
      return attachVendorSecurityHeaders(res);
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // 3. Magic Bytes Validation
    if (ext === "pdf" && !buffer.slice(0, 4).equals(Buffer.from([0x25, 0x50, 0x44, 0x46]))) {
      const res = NextResponse.json(
        { error: "Invalid PDF format. The uploaded file does not have a valid PDF header." },
        { status: 400 }
      );
      return attachVendorSecurityHeaders(res);
    }

    // 4. Upload to Cloudflare R2
    let objectKey = `vendor-documents/${session.tokenRecord.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    if (isR2Configured) {
      objectKey = await r2Storage.uploadAttachment(buffer, file.name, file.type || "application/octet-stream");
    }

    // 5. If draft status is invited, transition to in_progress
    if (session.draft && session.draft.onboardingStatus === "invited") {
      await db
        .update(vendorOnboardingDrafts)
        .set({ onboardingStatus: "in_progress", updatedAt: new Date() })
        .where(eq(vendorOnboardingDrafts.id, session.draft.id));
    }

    // 6. Insert document into database
    const [insertedDoc] = await db
      .insert(vendorDocuments)
      .values({
        draftId: session.draft?.id || null,
        vendorId: session.vendor?.id || null,
        invitationId: session.tokenRecord.id,
        documentType,
        documentName: file.name,
        fileUrl: objectKey,
        uploadedBySource: "vendor_onboarding",
        reviewStatus: "pending_review",
        expiryDate: expiryDateStr ? new Date(expiryDateStr) : null,
        status: "valid",
      })
      .returning();

    // 7. If linked to an existing vendor, update compliance scores immediately
    if (session.vendor?.id) {
      await complianceService.scanVendorDocuments(session.vendor.id);
    }

    // 8. Generate preview link if R2 configured
    let previewUrl = objectKey;
    if (isR2Configured) {
      try {
        previewUrl = await r2Storage.getReadPresignedUrl(objectKey, 604800);
      } catch {
        previewUrl = `/api/vendor-onboarding/documents/${insertedDoc.id}/preview`;
      }
    }

    const res = NextResponse.json({
      success: true,
      data: {
        ...insertedDoc,
        fileUrl: previewUrl,
        uploadedAt: insertedDoc.uploadedAt ? insertedDoc.uploadedAt.toISOString() : new Date().toISOString(),
      },
    });

    return attachVendorSecurityHeaders(res);
  } catch (error: any) {
    const status = error.statusCode || 500;
    if (status >= 500) {
      const correlationId = crypto.randomUUID();
      console.error(`[VENDOR_DOC_UPLOAD_ERROR:${correlationId}]`, error);
      const res = NextResponse.json(
        {
          error: `Unable to upload document. Please try again or contact administrator. Reference: ${correlationId}`,
          correlationId,
        },
        { status: 500 }
      );
      return attachVendorSecurityHeaders(res);
    }
    const res = NextResponse.json(
      { error: error.message || "Failed to upload document." },
      { status }
    );
    return attachVendorSecurityHeaders(res);
  }
}
