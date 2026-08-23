import { NextRequest, NextResponse } from "next/server";
import { getVendorSession, attachVendorSecurityHeaders } from "@/lib/vendor-auth";
import { vendorOnboardingService } from "@/lib/services/VendorOnboardingService";
import { durableRateLimiter } from "@/lib/services/DurableRateLimitService";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getVendorSession(req);

    if (session.isReadOnly) {
      const res = NextResponse.json(
        { error: "This profile has already been submitted." },
        { status: 403 }
      );
      return attachVendorSecurityHeaders(res);
    }

    if (!session.draft && !session.vendor) {
      const res = NextResponse.json(
        { error: "No active onboarding profile or draft associated with this session." },
        { status: 400 }
      );
      return attachVendorSecurityHeaders(res);
    }

    // Rate limit: 5 submissions per minute per token
    const rateCheck = await durableRateLimiter.consume(`submit:${session.tokenRecord.id}`, 5, 60);
    if (!rateCheck.allowed) {
      const res = NextResponse.json(
        { error: "Too many submission attempts. Please wait a moment." },
        { status: 429 }
      );
      return attachVendorSecurityHeaders(res);
    }

    const body = await req.json().catch(() => ({}));
    const { version, ...formData } = body;

    if (session.draft) {
      const mergedData = {
        companyName: session.draft.companyName,
        contactPerson: session.draft.contactPerson,
        contactNumber: session.draft.contactNumber,
        email: session.draft.email,
        address: session.draft.address,
        taxNumber: session.draft.taxNumber,
        registrationNumber: session.draft.registrationNumber,
        bankName: session.draft.bankName,
        accountNumber: session.draft.accountNumber,
        ibanNumber: session.draft.ibanNumber,
        branchName: session.draft.branchName,
        vendorType: session.draft.vendorType,
        category: session.draft.category,
        payment_currency: session.draft.payment_currency,
        ...formData,
        version: Number(version ?? session.draft.version),
      };

      const result = await vendorOnboardingService.submitVendorProfile({
        draftId: session.draft.id,
        invitationId: session.tokenRecord.id,
        data: mergedData,
        currentVersion: Number(version ?? session.draft.version),
      });

      const res = NextResponse.json({
        success: true,
        message: "Vendor profile successfully submitted for compliance review.",
        data: result,
      });
      return attachVendorSecurityHeaders(res);
    }

    // Existing vendor update
    const { db } = await import("@db");
    const { vendors, vendorOnboardingTokens, auditLogs } = await import("@db/schema");
    const { eq } = await import("drizzle-orm");
    const { complianceService } = await import("@/lib/services/ComplianceService");

    const updatePayload: Record<string, any> = { updatedAt: new Date() };
    if (formData.companyName) updatePayload.companyName = formData.companyName;
    if (formData.contactPerson) updatePayload.contactPerson = formData.contactPerson;
    if (formData.contactNumber) updatePayload.contactNumber = formData.contactNumber;
    if (formData.email) updatePayload.email = formData.email;
    if (formData.address !== undefined) updatePayload.address = formData.address;
    if (formData.taxNumber !== undefined) updatePayload.taxNumber = formData.taxNumber;
    if (formData.registrationNumber !== undefined) updatePayload.registrationNumber = formData.registrationNumber;
    if (formData.bankName !== undefined) updatePayload.bankName = formData.bankName;
    if (formData.branchName !== undefined) updatePayload.branchName = formData.branchName;
    if (formData.accountNumber !== undefined) updatePayload.accountNumber = formData.accountNumber;
    if (formData.ibanNumber !== undefined) updatePayload.ibanNumber = formData.ibanNumber;
    if (formData.payment_currency) updatePayload.payment_currency = formData.payment_currency;

    await db.update(vendors).set(updatePayload).where(eq(vendors.id, session.vendor.id));
    await db.update(vendorOnboardingTokens).set({ status: "submitted" }).where(eq(vendorOnboardingTokens.id, session.tokenRecord.id));

    // Recalculate compliance metrics
    await complianceService.scanVendorDocuments(session.vendor.id);

    await db.insert(auditLogs).values({
      action: "VENDOR_PROFILE_UPDATED",
      resourceType: "vendor",
      resourceId: session.vendor.id,
      details: {
        vendorId: session.vendor.id,
        companyName: session.vendor.companyName,
        invitationId: session.tokenRecord.id,
      },
    });

    const res = NextResponse.json({
      success: true,
      message: "Vendor compliance documentation and profile updated successfully.",
      data: { id: session.vendor.id },
    });
    return attachVendorSecurityHeaders(res);
  } catch (error: any) {
    const status = error.statusCode || 400;
    if (status >= 500) {
      const correlationId = crypto.randomUUID();
      console.error(`[VENDOR_SUBMIT_PROFILE_ERROR:${correlationId}]`, error);
      const res = NextResponse.json(
        {
          error: `Unable to submit vendor profile. Please try again or contact the administrator. Reference: ${correlationId}`,
          correlationId,
        },
        { status: 500 }
      );
      return attachVendorSecurityHeaders(res);
    }
    const res = NextResponse.json(
      { error: error.message || "Failed to submit profile." },
      { status }
    );
    return attachVendorSecurityHeaders(res);
  }
}
