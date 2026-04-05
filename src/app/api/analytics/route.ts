import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { purchaseRequests } from "@db/schema";
import { sql, count, sum } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { JWT_SECRET, TOKEN_COOKIE_NAME } from "../../../../server/utils/config";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // 1. Verify Session (Native implementation of Bridge Auth)
    const cookieHeader = req.headers.get("cookie") || "";
    const cookies: Record<string, string> = {};
    cookieHeader.split(";").forEach((c) => {
      const [key, value] = c.split("=").map((s) => s.trim());
      if (key && value) cookies[key] = value;
    });

    const token = cookies[TOKEN_COOKIE_NAME];
    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    try {
      jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    // 2. Optimized Grouped Aggregation
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
