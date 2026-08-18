import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { users } from "@db/schema";
import { eq } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/users/[id]/permissions
 * Update specific user permissions.
 * Access: Admin only.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: paramId } = await params;
    const admin = await getAuthenticatedUser(req);
    if (!admin) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    if (admin.role !== 'super_admin') {
      return NextResponse.json({ error: "Access denied. Super Admin role required." }, { status: 403 });
    }

    const userId = parseInt(paramId);
    if (isNaN(userId)) return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });

    const { canManageVendors } = await req.json();

    if (typeof canManageVendors !== "boolean") {
      return NextResponse.json({ error: "canManageVendors must be a boolean" }, { status: 400 });
    }

    // Check if target user exists
    const [targetUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!targetUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const [updatedUser] = await db
      .update(users)
      .set({ 
        canManageVendors, 
        updatedAt: new Date() 
      })
      .where(eq(users.id, userId))
      .returning();

    return NextResponse.json({
      id: updatedUser.id,
      username: updatedUser.username,
      canManageVendors: updatedUser.canManageVendors,
      message: `Updated Vendor Management permissions for ${updatedUser.username}`
    });
  } catch (error: any) {
    console.error("[Native API] User Permissions PATCH Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
