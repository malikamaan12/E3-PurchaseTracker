import { NextRequest, NextResponse } from "next/server";

const TOKEN_COOKIE_NAME = "auth_token";

/**
 * NATIVE LOGOUT
 */
export async function POST(req: NextRequest) {
  const traceId = Math.random().toString(36).substring(7);
  console.log(`[Auth][Native][${traceId}] Logout Start`);

  try {
    const response = NextResponse.json({ message: "Logged out successfully" });
    response.cookies.set(TOKEN_COOKIE_NAME, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/'
    });

    console.log(`[Auth][Native][${traceId}] SUCCESS: Logout`);
    return response;

  } catch (error: any) {
    console.error(`[Auth][Native][${traceId}] Logout error:`, error.message);
    return NextResponse.json({ message: "Logout failed" }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
