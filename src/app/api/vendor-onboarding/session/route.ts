import { NextRequest, NextResponse } from "next/server";
import { getVendorSession, attachVendorSecurityHeaders } from "@/lib/vendor-auth";
import { db } from "@db";
import { vendorDocuments } from "@db/schema";
import { eq, or, desc } from "drizzle-orm";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getVendorSession(req);

    // Fetch documents
    let documents: any[] = [];
    if (session.draft) {
      documents = await db
        .select()
        .from(vendorDocuments)
        .where(eq(vendorDocuments.draftId, session.draft.id))
        .orderBy(desc(vendorDocuments.uploadedAt));
    } else if (session.vendor) {
      documents = await db
        .select()
        .from(vendorDocuments)
        .where(eq(vendorDocuments.vendorId, session.vendor.id))
        .orderBy(desc(vendorDocuments.uploadedAt));
    }

    const standardRequiredDocs = [
      { type: "Commercial Registration", mandatory: true, description: "Valid CR with expiry date" },
      { type: "Tax Certificate", mandatory: false, description: "Optional tax identification certificate" },
      { type: "Establishment Card", mandatory: false, description: "Computer card / Municipality license" },
      { type: "Company Profile / Brochure", mandatory: false, description: "Company overview or catalog" }
    ];

    const draftData = session.draft || (session.vendor ? {
      id: 0,
      companyName: session.vendor.companyName,
      contactPerson: session.vendor.contactPerson || "",
      contactNumber: session.vendor.contactNumber || "",
      email: session.vendor.email || "",
      address: session.vendor.address || "",
      taxNumber: session.vendor.taxNumber || "",
      registrationNumber: session.vendor.registrationNumber || "",
      bankName: session.vendor.bankName || "",
      branchName: session.vendor.branchName || "",
      accountNumber: session.vendor.accountNumber || "",
      ibanNumber: session.vendor.ibanNumber || "",
      category: session.vendor.category || "general",
      payment_currency: session.vendor.payment_currency || "QAR",
      onboardingStatus: "in_progress",
      version: 1,
    } : null);

    const requiredDocs = (session.draft?.requiredDocumentTypes && session.draft.requiredDocumentTypes.length > 0)
      ? session.draft.requiredDocumentTypes
      : standardRequiredDocs;

    const response = NextResponse.json({
      success: true,
      data: {
        draft: draftData,
        vendor: session.vendor
          ? {
              id: session.vendor.id,
              companyName: session.vendor.companyName,
              contactPerson: session.vendor.contactPerson,
              contactNumber: session.vendor.contactNumber,
              email: session.vendor.email,
              address: session.vendor.address,
              taxNumber: session.vendor.taxNumber,
              registrationNumber: session.vendor.registrationNumber,
              category: session.vendor.category,
              payment_currency: session.vendor.payment_currency,
            }
          : null,
        documents,
        requiredDocumentTypes: requiredDocs,
        onboardingStatus: session.draft?.onboardingStatus || (session.vendor ? "in_progress" : "invited"),
        onboardingNotes: session.draft?.onboardingNotes || null,
        expiresAt: session.tokenRecord.expiresAt,
        remainingSeconds: session.remainingSeconds,
        isReadOnly: session.isReadOnly,
      },
    });

    return attachVendorSecurityHeaders(response);
  } catch (error: any) {
    const status = error.statusCode || 401;
    if (status >= 500) {
      const correlationId = crypto.randomUUID();
      console.error(`[VENDOR_SESSION_ERROR:${correlationId}]`, error);
      const res = NextResponse.json(
        {
          error: `Unable to retrieve onboarding session. Please try again or contact the administrator. Reference: ${correlationId}`,
          correlationId,
        },
        { status: 500 }
      );
      return attachVendorSecurityHeaders(res);
    }
    const response = NextResponse.json(
      { error: error.message || "Failed to retrieve onboarding session." },
      { status }
    );
    return attachVendorSecurityHeaders(response);
  }
}
