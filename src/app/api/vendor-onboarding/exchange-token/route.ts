import { NextRequest, NextResponse } from "next/server";
import { vendorOnboardingService } from "@/lib/services/VendorOnboardingService";
import { durableRateLimiter } from "@/lib/services/DurableRateLimitService";
import { setVendorSessionCookie } from "@/lib/vendor-auth";

export async function POST(req: NextRequest) {
  try {
    const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const ipHash = durableRateLimiter.hashIp(clientIp);

    // Rate limit: 10 token exchanges per minute per IP
    const rateCheck = await durableRateLimiter.consume(`exchange:${ipHash}`, 10, 60);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Too many exchange attempts. Please wait a moment and try again." },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { token } = body;

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "Token is required." },
        { status: 400 }
      );
    }

    // Verify token validity
    const verification = await vendorOnboardingService.verifyToken(token);

    const response = NextResponse.json({
      success: true,
      redirectUrl: "/vendor/portal",
      expiresAt: verification.tokenRecord.expiresAt,
    });

    // Set HttpOnly, Secure, SameSite=Strict cookie
    setVendorSessionCookie(response, token, verification.remainingSeconds);

    return response;
  } catch (error: any) {
    const status = error.statusCode || 401;
    return NextResponse.json(
      { error: error.message || "Invalid or expired onboarding token." },
      { status }
    );
  }
}
