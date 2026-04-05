import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { accountRequests } from "@db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/account-requests
 * Fetch all pending or processed account requests.
 * Access: Admin only.
 */
export async function GET(req: NextRequest) {
  try {
    const admin = await getAuthenticatedUser(req);
    if (!admin) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    if (admin.role !== 'admin') {
      return NextResponse.json({ error: "Access denied. Admin only route." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const department = searchParams.get("department");

    const whereConditions = [];
    if (status) whereConditions.push(eq(accountRequests.status, status));
    if (department) whereConditions.push(eq(accountRequests.department, department));

    const results = await db
      .select()
      .from(accountRequests)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(accountRequests.createdAt));

    return NextResponse.json(results);
  } catch (error: any) {
    console.error("[Native Admin API] Account Requests GET Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
