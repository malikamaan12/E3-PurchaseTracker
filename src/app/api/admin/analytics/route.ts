import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { purchaseRequests, users } from "@db/schema";
import { eq, sql } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/analytics
 * Fetch departmental spend analysis.
 * Access: Admin only.
 */
export async function GET(req: NextRequest) {
  try {
    const admin = await getAuthenticatedUser(req);
    if (!admin) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    if (admin.role !== 'admin') {
      return NextResponse.json({ error: "Access denied. Admin only route." }, { status: 403 });
    }

    const stats = await db
      .select({
        department: users.department,
        count: sql`count(${purchaseRequests.id})`.mapWith(Number),
        totalCost: sql`sum(${purchaseRequests.totalEstimatedCost})`.mapWith(Number)
      })
      .from(purchaseRequests)
      .innerJoin(users, eq(purchaseRequests.requesterId, users.id))
      .groupBy(users.department);

    return NextResponse.json(stats);
  } catch (error: any) {
    console.error("[Native Admin API] Admin Analytics GET Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
