import { NextRequest, NextResponse } from "next/server";
import { getVendorSession, attachVendorSecurityHeaders } from "@/lib/vendor-auth";
import { vendorUploadService } from "@/lib/services/VendorUploadService";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  try {
    const session = await getVendorSession(req);

    if (session.isReadOnly) {
      const res = NextResponse.json(
        { error: "Submitted documents cannot be deleted." },
        { status: 403 }
      );
      return attachVendorSecurityHeaders(res);
    }

    const { docId } = await params;
    const documentId = parseInt(docId, 10);

    if (isNaN(documentId)) {
      const res = NextResponse.json({ error: "Invalid document ID." }, { status: 400 });
      return attachVendorSecurityHeaders(res);
    }

    await vendorUploadService.deleteDraftDocument({
      docId: documentId,
      invitationId: session.tokenRecord.id,
      draftId: session.draft?.id || null,
    });

    const res = NextResponse.json({ success: true });
    return attachVendorSecurityHeaders(res);
  } catch (error: any) {
    const status = error.statusCode || 400;
    const res = NextResponse.json(
      { error: error.message || "Failed to delete document." },
      { status }
    );
    return attachVendorSecurityHeaders(res);
  }
}
