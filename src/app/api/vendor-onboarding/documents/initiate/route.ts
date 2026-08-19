import { NextRequest, NextResponse } from "next/server";
import { getVendorSession, attachVendorSecurityHeaders } from "@/lib/vendor-auth";
import { vendorUploadService } from "@/lib/services/VendorUploadService";
import { durableRateLimiter } from "@/lib/services/DurableRateLimitService";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    // Rate limit: 20 upload initiations per minute
    const rateCheck = await durableRateLimiter.consume(`upload_init:${session.tokenRecord.id}`, 20, 60);
    if (!rateCheck.allowed) {
      const res = NextResponse.json(
        { error: "Too many upload requests. Please wait a moment." },
        { status: 429 }
      );
      return attachVendorSecurityHeaders(res);
    }

    const body = await req.json().catch(() => ({}));
    const { documentType, fileName, fileSize, mimeType } = body;

    if (!documentType || !fileName || !fileSize || !mimeType) {
      const res = NextResponse.json(
        { error: "Missing required upload parameters (documentType, fileName, fileSize, mimeType)." },
        { status: 400 }
      );
      return attachVendorSecurityHeaders(res);
    }

    const intent = await vendorUploadService.initiateUploadIntent({
      invitationId: session.tokenRecord.id,
      draftId: session.draft?.id || null,
      vendorId: session.vendor?.id || null,
      documentType,
      fileName,
      fileSize: Number(fileSize),
      mimeType,
    });

    const res = NextResponse.json({
      success: true,
      data: intent,
    });
    return attachVendorSecurityHeaders(res);
  } catch (error: any) {
    const status = error.statusCode || 400;
    if (status >= 500) {
      const correlationId = crypto.randomUUID();
      console.error(`[VENDOR_UPLOAD_INIT_ERROR:${correlationId}]`, error);
      const res = NextResponse.json(
        {
          error: `Unable to initiate document upload. Please try again or contact the administrator. Reference: ${correlationId}`,
          correlationId,
        },
        { status: 500 }
      );
      return attachVendorSecurityHeaders(res);
    }
    const res = NextResponse.json(
      { error: error.message || "Failed to initiate document upload." },
      { status }
    );
    return attachVendorSecurityHeaders(res);
  }
}
