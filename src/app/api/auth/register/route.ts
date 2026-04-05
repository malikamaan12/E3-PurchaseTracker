import { NextRequest, NextResponse } from "next/server";
import * as bcrypt from 'bcryptjs';
import { db } from "@db";
import { JWT_SECRET, TOKEN_COOKIE_NAME, COOKIE_OPTIONS } from "@/lib/utils/config";
import { AppError } from "@/lib/utils/errors";
import { accountRequests, users } from "@db/schema";
import { eq, or } from "drizzle-orm";

/**
 * NATIVE NEXT.JS REGISTER ROUTE
 * Handles user sign-up by creating an account request for admin approval.
 * Bypasses the Express bridge to prevent 12s Gateway Timeouts.
 */
export async function POST(req: NextRequest) {
  const traceId = Math.random().toString(36).substring(7);
  console.log(`[Auth][Native][${traceId}] Register Request Start`);

  try {
    const body = await req.json();
    
    const { username, password, email, contact_number, department } = body;

    // 1. Basic Validation
    if (!username || !password || !email || !department || !contact_number) {
       return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
    }

    if (password.length < 6) {
       return NextResponse.json({ message: "Password must be at least 6 characters" }, { status: 400 });
    }

    // 2. Check for Existing User or Pending Request
    console.log(`[Auth][Native][${traceId}] Checking availability: ${username} / ${email}`);
    
    // Check users table
    const [existingUser] = await db.select().from(users).where(eq(users.username, username)).limit(1);
    if (existingUser) {
      console.warn(`[Auth][Native][${traceId}] Conflict: Username ${username} already exists`);
      return NextResponse.json({ message: "Username already exists" }, { status: 409 });
    }

    // Check accountRequests table
    const [existingRequest] = await db.select().from(accountRequests)
      .where(or(eq(accountRequests.username, username), eq(accountRequests.email, email)))
      .limit(1);
      
    if (existingRequest && existingRequest.status === "pending") {
      console.warn(`[Auth][Native][${traceId}] Conflict: Pending request exists for ${username}/${email}`);
      return NextResponse.json({ message: "A pending request already exists for this username or email" }, { status: 409 });
    }

    // 3. Password Hashing
    console.log(`[Auth][Native][${traceId}] Hashing password...`);
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Create Account Request
    console.log(`[Auth][Native][${traceId}] Inserting account request...`);
    await db.insert(accountRequests).values({
      username,
      password: hashedPassword,
      email,
      contact_number,
      department,
      role: "user",
      status: "pending"
    });

    console.log(`[Auth][Native][${traceId}] SUCCESS: ${username}`);
    return NextResponse.json({ 
      message: "Account request submitted successfully! Please wait for admin approval." 
    }, { status: 201 });

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
