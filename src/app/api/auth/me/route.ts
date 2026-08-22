import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { JWT_SECRET, TOKEN_COOKIE_NAME } from "@/lib/utils/config";

/**
 * NATIVE SESSION VERIFICATION (/api/auth/me)
 * Supports cookie session and Bearer authorization header fallback.
 */
export async function GET(req: NextRequest) {
  const traceId = Math.random().toString(36).substring(7);

  try {
    let token = req.cookies.get(TOKEN_COOKIE_NAME)?.value;
    
    // Check Authorization header fallback
    if (!token) {
      const authHeader = req.headers.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.substring(7).trim();
      }
    }

    if (!token) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload: decoded } = await jwtVerify(token, secret);
    return NextResponse.json(decoded);

  } catch (error: any) {
    const response = NextResponse.json({ message: "Session expired" }, { status: 401 });
    response.cookies.delete(TOKEN_COOKIE_NAME);
    return response;
  }
}

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
