import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { JWT_SECRET, TOKEN_COOKIE_NAME } from "@/../server/utils/config";

/**
 * NATIVE SESSION VERIFICATION
 */
export async function GET(req: NextRequest) {
  const traceId = Math.random().toString(36).substring(7);
  console.log(`[Auth][Native][${traceId}] Session Verification Start`);

  try {
    const token = req.cookies.get(TOKEN_COOKIE_NAME)?.value;
    
    if (!token) {
      console.warn(`[Auth][Native][${traceId}] No session token found.`);
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    console.log(`[Auth][Native][${traceId}] SUCCESS: ${decoded.username} | Role: ${decoded.role} | Dept: ${decoded.department}`);
    return NextResponse.json(decoded);

  } catch (error: any) {
    console.error(`[Auth][Native][${traceId}] Session error:`, error.message);
    const response = NextResponse.json({ message: "Session expired" }, { status: 401 });
    response.cookies.delete(TOKEN_COOKIE_NAME);
    return response;
  }
}

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
