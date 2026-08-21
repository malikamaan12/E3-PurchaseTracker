import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { vendorOnboardingService, UnauthorizedError } from "./services/VendorOnboardingService";

export const VENDOR_SESSION_COOKIE_NAME = "vendor_session";

export interface VendorSessionContext {
  tokenRecord: any;
  draft: any;
  vendor: any;
  remainingSeconds: number;
  isReadOnly: boolean;
  rawToken: string;
}

/**
 * Extracts and verifies the vendor session from the HttpOnly cookie.
 * Validates against database on every request.
 */
export async function getVendorSession(req?: NextRequest): Promise<VendorSessionContext> {
  let rawToken: string | undefined;

  if (req) {
    rawToken = req.cookies.get(VENDOR_SESSION_COOKIE_NAME)?.value;
  } else {
    const cookieStore = await cookies();
    rawToken = cookieStore.get(VENDOR_SESSION_COOKIE_NAME)?.value;
  }

  if (!rawToken) {
    throw new UnauthorizedError("Vendor session missing or expired. Please use your onboarding link.");
  }

  const verification = await vendorOnboardingService.verifyToken(rawToken);

  return {
    ...verification,
    rawToken,
  };
}

/**
 * Attaches comprehensive privacy and anti-framing security headers to vendor responses
 */
export function attachVendorSecurityHeaders(response: NextResponse): NextResponse {
  const r2Origin = process.env.R2_ENDPOINT
    ? (() => {
        try {
          return new URL(process.env.R2_ENDPOINT).origin;
        } catch {
          return process.env.R2_ENDPOINT;
        }
      })()
    : "https://r2.cloudflarestorage.com";

  const vendorCsp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    `img-src 'self' data: blob: ${r2Origin} https://*.r2.cloudflarestorage.com`,
    `connect-src 'self' ${r2Origin} https://*.r2.cloudflarestorage.com`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");

  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Content-Security-Policy", vendorCsp);
  return response;
}

/**
 * Sets the secure vendor session cookie on a NextResponse
 */
export function setVendorSessionCookie(
  response: NextResponse,
  rawToken: string,
  maxAgeSeconds: number
) {
  const isProduction = process.env.NODE_ENV === "production";

  response.cookies.set(VENDOR_SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    path: "/",
    maxAge: Math.max(0, maxAgeSeconds),
  });

  attachVendorSecurityHeaders(response);
}

/**
 * Clears the vendor session cookie
 */
export function clearVendorSessionCookie(response: NextResponse) {
  response.cookies.set(VENDOR_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });

  attachVendorSecurityHeaders(response);
}
