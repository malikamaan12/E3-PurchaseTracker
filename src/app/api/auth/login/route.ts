import { NextRequest, NextResponse } from "next/server";
import * as bcrypt from 'bcryptjs';
import jwt from "jsonwebtoken";
import { db } from "@/db"; // Use established db connection
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET || "purchase-management-system-v1-secret-key";
const TOKEN_COOKIE_NAME = "auth_token";

/**
 * NATIVE NEXT.JS LOGIN ROUTE
 * This bypasses the Express bridge to eliminate any overhead or hangs 
 * during the critical authentication path on Vercel.
 */
export async function POST(req: NextRequest) {
  const traceId = Math.random().toString(36).substring(7);
  console.log(`[Auth][Native][${traceId}] Login Request Start`);

  try {
    const { username, password } = await req.json();

    // 1. Database Lookup
    console.log(`[Auth][Native][${traceId}] Querying user: ${username}`);
    const startTimeDb = Date.now();
    const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
    console.log(`[Auth][Native][${traceId}] DB result in ${Date.now() - startTimeDb}ms`);

    if (!user) {
      console.warn(`[Auth][Native][${traceId}] User not found: ${username}`);
      return NextResponse.json({ message: "Invalid username or password" }, { status: 401 });
    }

    if (!user.isActive) {
      console.warn(`[Auth][Native][${traceId}] Inactive account: ${username}`);
      return NextResponse.json({ message: "Account is inactive" }, { status: 401 });
    }

    // 2. Password Comparison
    console.log(`[Auth][Native][${traceId}] Comparing password...`);
    const startTimeBcrypt = Date.now();
    const isMatch = await bcrypt.compare(password, user.password);
    console.log(`[Auth][Native][${traceId}] Bcrypt finished in ${Date.now() - startTimeBcrypt}ms`);

    if (!isMatch) {
      console.warn(`[Auth][Native][${traceId}] Password mismatch: ${username}`);
      return NextResponse.json({ message: "Invalid username or password" }, { status: 401 });
    }

    // 3. Session Generation
    const sanitizedUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      department: user.department,
      role: user.role,
      contactNumber: user.contact_number,
      isActive: user.isActive
    };

    const token = jwt.sign(sanitizedUser, JWT_SECRET, { expiresIn: '24h' });
    
    // 4. Response with HTTP-Only Cookie
    const response = NextResponse.json({ user: sanitizedUser });
    response.cookies.set(TOKEN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // 24 hours
      path: '/'
    });

    console.log(`[Auth][Native][${traceId}] SUCCESS: ${username}`);
    return response;

  } catch (error: any) {
    console.error(`[Auth][Native][${traceId}] FATAL ERROR:`, error.message);
    return NextResponse.json({ 
      error: "Internal Server Error", 
      message: error.message 
    }, { status: 500 });
  }
}

// Add these to force dynamic behavior and avoid build-time static generation
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
