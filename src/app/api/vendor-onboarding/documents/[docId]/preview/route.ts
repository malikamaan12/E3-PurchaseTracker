import { NextRequest, NextResponse } from "next/server";
import { getVendorSession, attachVendorSecurityHeaders } from "@/lib/vendor-auth";
import { vendorUploadService } from "@/lib/services/VendorUploadService";
import { db } from "@db";
import { vendorDocuments } from "@db/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  try {
    const session = await getVendorSession(req);
    const { docId } = await params;
    const documentId = parseInt(docId, 10);

    if (isNaN(documentId)) {
      const res = NextResponse.json({ error: "Invalid document ID." }, { status: 400 });
      return attachVendorSecurityHeaders(res);
    }

    // Verify document belongs to current session
    const [doc] = await db
      .select()
      .from(vendorDocuments)
      .where(
        and(
          eq(vendorDocuments.id, documentId),
          session.draft
            ? eq(vendorDocuments.draftId, session.draft.id)
            : session.vendor
            ? eq(vendorDocuments.vendorId, session.vendor.id)
            : eq(vendorDocuments.invitationId, session.tokenRecord.id)
        )
      )
      .limit(1);

    if (!doc) {
      const res = NextResponse.json({ error: "Document not found or access denied." }, { status: 404 });
      return attachVendorSecurityHeaders(res);
    }

    const downloadUrl = await vendorUploadService.getPresignedDownloadUrl(
      doc.fileUrl,
      doc.documentName
    );

    const res = NextResponse.json({
      success: true,
      downloadUrl,
      fileName: doc.documentName,
      documentType: doc.documentType,
    });
    return attachVendorSecurityHeaders(res);
  } catch (error: any) {
    const status = error.statusCode || 400;
    if (status >= 500) {
      const correlationId = crypto.randomUUID();
      console.error(`[VENDOR_DOC_PREVIEW_ERROR:${correlationId}]`, error);
      const res = NextResponse.json(
        {
          error: `Unable to generate document preview. Please try again or contact the administrator. Reference: ${correlationId}`,
          correlationId,
        },
        { status: 500 }
      );
      return attachVendorSecurityHeaders(res);
    }
    const res = NextResponse.json(
      { error: error.message || "Failed to generate download link." },
      { status }
    );
    return attachVendorSecurityHeaders(res);
  }
}
