import { NextRequest, NextResponse } from "next/server";
import { getVendorSession, attachVendorSecurityHeaders } from "@/lib/vendor-auth";
import { vendorUploadService } from "@/lib/services/VendorUploadService";

export async function POST(req: NextRequest) {
  try {
    const session = await getVendorSession(req);

    if (session.isReadOnly) {
      const res = NextResponse.json(
        { error: "This profile has already been submitted and cannot finalize new documents." },
        { status: 403 }
      );
      return attachVendorSecurityHeaders(res);
    }

    const body = await req.json().catch(() => ({}));
    const { intentId, expiryDate } = body;

    if (!intentId) {
      const res = NextResponse.json(
        { error: "Upload intent ID is required." },
        { status: 400 }
      );
      return attachVendorSecurityHeaders(res);
    }

    const document = await vendorUploadService.completeUploadIntent({
      intentId: Number(intentId),
      invitationId: session.tokenRecord.id,
      expiryDate: expiryDate || null,
    });

    const res = NextResponse.json({
      success: true,
      data: document,
    });
    return attachVendorSecurityHeaders(res);
  } catch (error: any) {
    const status = error.statusCode || 400;
    const res = NextResponse.json(
      { error: error.message || "Failed to finalize document upload." },
      { status }
    );
    return attachVendorSecurityHeaders(res);
  }
}
