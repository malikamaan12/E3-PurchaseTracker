import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { users, purchaseRequests } from "@db/schema";
import { eq } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/users/[id]
 * Fetch specific user details.
 * Access: Admin only.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const admin = await getAuthenticatedUser(req);
    if (!admin) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    if (admin.role !== 'admin' && admin.role !== 'super_admin') {
      return NextResponse.json({ error: "Access denied. Admin only route." }, { status: 403 });
    }

    const userId = parseInt(id);
    if (isNaN(userId)) return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });

    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        department: users.department,
        role: users.role,
        canManageVendors: users.canManageVendors,
        contact_number: users.contact_number,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    return NextResponse.json(user);
  } catch (error: any) {
    console.error("[Native Admin API] User GET Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/users/[id]
 * Standardized update for user details (role, isActive, permissions).
 * Access: Admin only.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const admin = await getAuthenticatedUser(req);
    if (!admin) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    if (admin.role !== 'admin' && admin.role !== 'super_admin') {
      return NextResponse.json({ error: "Access denied. Admin only." }, { status: 403 });
    }

    const userId = parseInt(id);
    if (isNaN(userId)) return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });

    const body = await req.json();
    
    // Governance Guard: Only Super Admin can change user roles
    if (body.role !== undefined && admin.role !== 'super_admin') {
      return NextResponse.json(
        { error: "Access denied. Only Super Admin has governance authority to modify user roles." },
        { status: 403 }
      );
    }

    // Payload Sanitization: Only allow specific fields
    const updateData: any = {};
    if (body.role !== undefined) updateData.role = body.role;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.canManageVendors !== undefined) updateData.canManageVendors = body.canManageVendors;
    if (body.department !== undefined) updateData.department = body.department;
    if (body.contact_number !== undefined) updateData.contact_number = body.contact_number;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    updateData.updatedAt = new Date();

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();

    if (!updated) return NextResponse.json({ error: "User not found" }, { status: 404 });

    return NextResponse.json({ message: "User updated successfully", user: updated });
  } catch (error: any) {
    console.error("[Native Admin API] User PATCH Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/users/[id]
 * Delete a user profile (with Safe Deletion logic).
 * Access: Admin only.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const admin = await getAuthenticatedUser(req);
    if (!admin) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    if (admin.role !== 'admin' && admin.role !== 'super_admin') {
      return NextResponse.json({ error: "Access denied. Admin only route." }, { status: 403 });
    }

    const userId = parseInt(id);
    if (isNaN(userId)) return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });

    // 1. Check for references in Purchase Requests
    const [pr] = await db
      .select()
      .from(purchaseRequests)
      .where(eq(purchaseRequests.requesterId, userId))
      .limit(1);

    if (pr) {
      return NextResponse.json({ 
        error: "Cannot delete user with requests", 
        message: "This user has initiated purchase requests. To preserve the audit trail, consider deactivating the user instead of deleting the profile."
      }, { status: 400 });
    }

    // 2. Perform deletion
    const [deleted] = await db
      .delete(users)
      .where(eq(users.id, userId))
      .returning();

    if (!deleted) return NextResponse.json({ error: "User not found" }, { status: 404 });

    return NextResponse.json({ message: "User deleted successfully", user: { id: deleted.id, username: deleted.username } });
  } catch (error: any) {
    console.error("[Native Admin API] User DELETE Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
