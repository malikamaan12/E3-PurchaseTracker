import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { purchaseRequests } from "@db/schema";
import { count, sum } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";

export const dynamic = 'force-dynamic';

// GET /api/requests/analytics
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    // Execute a single grouped aggregation to prevent multiple round-trips
    const stats = await db
      .select({
        status: purchaseRequests.status,
        count: count(),
        totalSpend: sum(purchaseRequests.totalEstimatedCost)
      })
      .from(purchaseRequests)
      .groupBy(purchaseRequests.status);

    const formattedStats = stats.reduce((acc: any, curr: any) => {
      acc[curr.status] = {
        count: Number(curr.count) || 0,
        total: Number(curr.totalSpend) || 0
      };
      return acc;
    }, {});

    return NextResponse.json(formattedStats);
  } catch (error: any) {
    console.error("[Native API] Analytics Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
