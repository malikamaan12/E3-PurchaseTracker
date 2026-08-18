import { NextRequest, NextResponse } from "next/server";
import * as bcrypt from 'bcryptjs';
import { SignJWT } from "jose";
import { db } from "@db";
import { users, departments } from "@db/schema";
import { eq } from "drizzle-orm";
import { JWT_SECRET, TOKEN_COOKIE_NAME, IS_PRODUCTION } from "@/lib/utils/config";
import { AppError } from "@/lib/utils/errors";

/**
 * NATIVE NEXT.JS LOGIN ROUTE
 * This bypasses the Express bridge to eliminate any overhead or hangs 
 * during the critical authentication path on Vercel.
 */
export async function POST(req: NextRequest) {
  const traceId = Math.random().toString(36).substring(7);
  console.log(`[Auth][Native][${traceId}] Login Request Start`);

  try {
    const { email, password } = await req.json();

    // 1. Database Lookup
    console.log(`[Auth][Native][${traceId}] Querying user: ${email}`);
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (!user || !user.isActive) {
      console.warn(`[Auth][Native][${traceId}] Auth failed: ${email}`);
      return NextResponse.json({ message: "Invalid email or password" }, { status: 401 });
    }

    // 2. Password Comparison
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.warn(`[Auth][Native][${traceId}] Password mismatch: ${email}`);
      return NextResponse.json({ message: "Invalid email or password" }, { status: 401 });
    }

    // 3. Department Lookup to determine Approval Authority
    const [dept] = await db.select()
      .from(departments)
      .where(eq(departments.name, user.department))
      .limit(1);

    const isApprover = dept?.isApprover || user.role === 'admin' || user.role === 'super_admin';

    // 4. Session Generation
    const sanitizedUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      department: user.department,
      role: user.role,
      contactNumber: user.contact_number,
      isActive: user.isActive,
      isApprover, // Inject the dynamic flag
      canManageVendors: user.canManageVendors // Inject the new permission
    };

    const secret = new TextEncoder().encode(JWT_SECRET);
    const token = await new SignJWT(sanitizedUser)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('300h')
      .sign(secret);
    
    // 4. Response with HTTP-Only Cookie (Lax sameSite for reliable multi-tab & export navigation)
    const response = NextResponse.json({ user: sanitizedUser });
    response.cookies.set(TOKEN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: IS_PRODUCTION,
      sameSite: 'lax',
      maxAge: 300 * 60 * 60, // 300 hours
      path: '/'
    });

    console.log(`[Auth][Native][${traceId}] SUCCESS: ${email}`);
    return response;

  } catch (error: any) {
    console.error(`[Auth][Native][${traceId}] FATAL ERROR:`, error.message);
    return NextResponse.json({ 
      error: "Internal Server Error", 
      message: error.message 
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
