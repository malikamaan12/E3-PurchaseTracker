import { NextRequest, NextResponse } from "next/server";
import { getVendorSession, attachVendorSecurityHeaders } from "@/lib/vendor-auth";
import { vendorOnboardingService } from "@/lib/services/VendorOnboardingService";
import { durableRateLimiter } from "@/lib/services/DurableRateLimitService";
import { vendorSelfServiceSaveSchema } from "@db/schema";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest) {
  try {
    const session = await getVendorSession(req);

    if (session.isReadOnly) {
      const res = NextResponse.json(
        { error: "This profile has already been submitted and cannot be edited." },
        { status: 403 }
      );
      return attachVendorSecurityHeaders(res);
    }

    if (!session.draft) {
      const res = NextResponse.json(
        { error: "No active draft associated with this session." },
        { status: 400 }
      );
      return attachVendorSecurityHeaders(res);
    }

    // Rate limit: 60 draft saves per minute per token
    const rateCheck = await durableRateLimiter.consume(`save:${session.tokenRecord.id}`, 60, 60);
    if (!rateCheck.allowed) {
      const res = NextResponse.json(
        { error: "Too many save requests. Please wait a moment." },
        { status: 429 }
      );
      return attachVendorSecurityHeaders(res);
    }

    const body = await req.json().catch(() => ({}));
    const parseResult = vendorSelfServiceSaveSchema.safeParse(body);

    if (!parseResult.success) {
      const errMsg = parseResult.error.issues.map((i) => i.message).join(", ");
      const res = NextResponse.json({ error: errMsg }, { status: 400 });
      return attachVendorSecurityHeaders(res);
    }

    const updated = await vendorOnboardingService.saveDraftProgress({
      draftId: session.draft.id,
      invitationId: session.tokenRecord.id,
      data: parseResult.data,
      currentVersion: parseResult.data.version,
    });

    const res = NextResponse.json({
      success: true,
      data: updated,
    });
    return attachVendorSecurityHeaders(res);
  } catch (error: any) {
    const status = error.statusCode || 500;
    if (status >= 500) {
      const correlationId = crypto.randomUUID();
      console.error(`[VENDOR_DRAFT_SAVE_ERROR:${correlationId}]`, error);
      const res = NextResponse.json(
        {
          error: `Unable to save draft progress. Please try again or contact the administrator. Reference: ${correlationId}`,
          correlationId,
        },
        { status: 500 }
      );
      return attachVendorSecurityHeaders(res);
    }
    const res = NextResponse.json(
      { error: error.message || "Failed to save draft progress." },
      { status }
    );
    return attachVendorSecurityHeaders(res);
  }
}
