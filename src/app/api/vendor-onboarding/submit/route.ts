import { NextRequest, NextResponse } from "next/server";
import { getVendorSession, attachVendorSecurityHeaders } from "@/lib/vendor-auth";
import { vendorOnboardingService } from "@/lib/services/VendorOnboardingService";
import { durableRateLimiter } from "@/lib/services/DurableRateLimitService";

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

    if (!session.draft) {
      const res = NextResponse.json(
        { error: "No active onboarding draft associated with this session." },
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

    const result = await vendorOnboardingService.submitVendorProfile({
      draftId: session.draft.id,
      invitationId: session.tokenRecord.id,
      data: { ...formData, version: Number(version) },
      currentVersion: Number(version),
    });

    const res = NextResponse.json({
      success: true,
      message: "Vendor profile successfully submitted for compliance review.",
      data: result,
    });
    return attachVendorSecurityHeaders(res);
  } catch (error: any) {
    const status = error.statusCode || 400;
    const res = NextResponse.json(
      { error: error.message || "Failed to submit profile." },
      { status }
    );
    return attachVendorSecurityHeaders(res);
  }
}
