import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { accountRequests, users } from "@db/schema";
import { eq } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/account-requests/[id]/approve
 * Promote an account request to a full user.
 * Access: Admin only.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const admin = await getAuthenticatedUser(req);
    if (!admin) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    if (admin.role !== 'super_admin') {
      return NextResponse.json({ error: "Access denied. Super Admin role required." }, { status: 403 });
    }

    const requestId = parseInt(id);
    if (isNaN(requestId)) return NextResponse.json({ error: "Invalid request ID" }, { status: 400 });

    // 1. Fetch the request
    const [request] = await db
      .select()
      .from(accountRequests)
      .where(eq(accountRequests.id, requestId))
      .limit(1);

    if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });
    if (request.status !== "pending") {
      return NextResponse.json({ error: "Only pending requests can be approved" }, { status: 400 });
    }

    // 2. Check if username already exists in users table
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.username, request.username))
      .limit(1);

    if (existingUser) {
      return NextResponse.json({ 
        error: "Username already taken", 
        message: "A user with this username already exists in the system." 
      }, { status: 400 });
    }

    // 3. BEGIN TRANSACTION (using sequential calls as it's simple enough)
    // Create the user
    const [newUser] = await db
      .insert(users)
      .values({
        username: request.username,
        password: request.password,
        email: request.email,
        contact_number: request.contact_number,
        department: request.department,
        role: request.role,
        isActive: true,
      })
      .returning();

    // Update account request status
    await db
      .update(accountRequests)
      .set({ status: "approved" })
      .where(eq(accountRequests.id, requestId));

    return NextResponse.json({ 
      message: "Account request approved successfully", 
      user: { id: newUser.id, username: newUser.username } 
    });
  } catch (error: any) {
    console.error("[Native Admin API] Account Request Approve Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
