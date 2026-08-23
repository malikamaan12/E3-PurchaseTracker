import { NextRequest, NextResponse } from "next/server";
import * as bcrypt from 'bcryptjs';
import { db } from "@db";
import { JWT_SECRET, TOKEN_COOKIE_NAME, COOKIE_OPTIONS } from "@/lib/utils/config";
import { AppError } from "@/lib/utils/errors";
import { accountRequests, users } from "@db/schema";
import { eq, or } from "drizzle-orm";
import { durableRateLimiter } from "@/lib/services/DurableRateLimitService";

/**
 * NATIVE NEXT.JS REGISTER ROUTE
 * Handles user sign-up by creating an account request for admin approval.
 * Bypasses the Express bridge to prevent 12s Gateway Timeouts.
 */
export async function POST(req: NextRequest) {
  const traceId = Math.random().toString(36).substring(7);
  console.log(`[Auth][Native][${traceId}] Register Request Start`);

  try {
    const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const ipHash = durableRateLimiter.hashIp(clientIp);

    // Rate limiting: 5 registration requests per minute per IP
    const rateCheck = await durableRateLimiter.consume(`auth:register:${ipHash}`, 5, 60);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { message: "Too many registration attempts. Please wait a few minutes before trying again." },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    
    const { username, password, email, contact_number, department } = body;

    // 1. Basic Validation
    if (!username || !password || !email || !department || !contact_number) {
       return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(String(email).trim())) {
       return NextResponse.json({ message: "Invalid email format" }, { status: 400 });
    }

    if (typeof username !== 'string' || username.trim().length < 3) {
       return NextResponse.json({ message: "Username must be at least 3 characters" }, { status: 400 });
    }

    if (typeof password !== 'string' || password.length < 6) {
       return NextResponse.json({ message: "Password must be at least 6 characters" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim();

    // 2. Check for Existing User or Pending Request
    console.log(`[Auth][Native][${traceId}] Checking availability: ${cleanUsername} / ${cleanEmail}`);
    
    // Check users table
    const [existingUser] = await db.select().from(users).where(or(eq(users.username, cleanUsername), eq(users.email, cleanEmail))).limit(1);
    if (existingUser) {
      console.warn(`[Auth][Native][${traceId}] Conflict: User already exists for ${cleanUsername}/${cleanEmail}`);
      return NextResponse.json({ message: "Username or email already in use" }, { status: 409 });
    }

    // Check accountRequests table
    const [existingRequest] = await db.select().from(accountRequests)
      .where(or(eq(accountRequests.username, cleanUsername), eq(accountRequests.email, cleanEmail)))
      .limit(1);
      
    if (existingRequest) {
      if (existingRequest.status === "pending") {
        console.warn(`[Auth][Native][${traceId}] Conflict: Pending request exists for ${cleanUsername}/${cleanEmail}`);
        return NextResponse.json({ message: "A pending request already exists for this username or email" }, { status: 409 });
      }

      // 3. Password Hashing & Re-submission for rejected request
      console.log(`[Auth][Native][${traceId}] Re-submitting existing rejected request...`);
      const hashedPassword = await bcrypt.hash(password, 10);
      await db.update(accountRequests).set({
        username: cleanUsername,
        password: hashedPassword,
        email: cleanEmail,
        contact_number: String(contact_number).trim(),
        department: String(department).trim(),
        role: "user",
        status: "pending",
        updatedAt: new Date()
      }).where(eq(accountRequests.id, existingRequest.id));

      console.log(`[Auth][Native][${traceId}] SUCCESS (Re-submitted): ${cleanUsername}`);
      return NextResponse.json({ 
        message: "Account request re-submitted successfully! Please wait for admin approval." 
      }, { status: 200 });
    }

    // 3. Password Hashing
    console.log(`[Auth][Native][${traceId}] Hashing password...`);
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Create Account Request
    console.log(`[Auth][Native][${traceId}] Inserting account request...`);
    await db.insert(accountRequests).values({
      username: cleanUsername,
      password: hashedPassword,
      email: cleanEmail,
      contact_number: String(contact_number).trim(),
      department: String(department).trim(),
      role: "user",
      status: "pending"
    });

    console.log(`[Auth][Native][${traceId}] SUCCESS: ${cleanUsername}`);
    return NextResponse.json({ 
      message: "Account request submitted successfully! Please wait for admin approval." 
    }, { status: 201 });

  } catch (error: any) {
    console.error(`[Auth][Native][${traceId}] FATAL ERROR:`, error?.message || error);
    return NextResponse.json({ 
      error: "Internal Server Error", 
      message: "An unexpected error occurred while processing registration." 
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
