import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { users } from "@db/schema";
import { eq } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/users/[id]/update-role
 * Change role of a user.
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

    const { role } = await req.json();

    if (!["user", "supervisor", "approver", "admin"].includes(role)) {
      return NextResponse.json({ error: "Invalid role value" }, { status: 400 });
    }

    const [updated] = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();

    if (!updated) return NextResponse.json({ error: "User not found" }, { status: 404 });

    return NextResponse.json({ message: "Role updated successfully", user: updated });
  } catch (error: any) {
    console.error("[Native Admin API] User Role Update Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
