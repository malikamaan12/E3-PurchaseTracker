import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { accountRequests } from "@db/schema";
import { eq } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/account-requests/[id]/reject
 * Reject a pending account request.
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

    const [updated] = await db
      .update(accountRequests)
      .set({ status: "rejected" })
      .where(eq(accountRequests.id, requestId))
      .returning();

    if (!updated) return NextResponse.json({ error: "Request not found" }, { status: 404 });

    return NextResponse.json({ message: "Account request rejected successfully", requestIdUpdated: updated.id });
  } catch (error: any) {
    console.error("[Native Admin API] Account Request Reject Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
