import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { purchaseRequests, users } from "@db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { JWT_SECRET, TOKEN_COOKIE_NAME } from "../../../../server/utils/config";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // 1. Verify Session
    const cookieHeader = req.headers.get("cookie") || "";
    const cookies: Record<string, string> = {};
    cookieHeader.split(";").forEach((c) => {
      const [key, value] = c.split("=").map((s) => s.trim());
      if (key && value) cookies[key] = value;
    });

    const token = cookies[TOKEN_COOKIE_NAME];
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    let userId, role, department;
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      userId = decoded.id;
      role = decoded.role;
      department = decoded.department;
    } catch (err) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const deptFilter = searchParams.get("department");

    const whereConditions = [];

    // Filter Logic
    if (status) {
      whereConditions.push(inArray(purchaseRequests.status, status.split(",")));
    }

    if (deptFilter) {
      whereConditions.push(eq(users.department, deptFilter));
    }

    // Role-based visibility
    if (role !== "admin" && role !== "approver") {
      whereConditions.push(eq(users.department, department));
    }

    const requests = await db
      .select({
        id: purchaseRequests.id,
        requestNumber: purchaseRequests.requestNumber,
        title: purchaseRequests.title,
        status: purchaseRequests.status,
        totalEstimatedCost: purchaseRequests.totalEstimatedCost,
        createdAt: purchaseRequests.createdAt,
        updatedAt: purchaseRequests.updatedAt,
        purposeType: purchaseRequests.purposeType,
        priority: purchaseRequests.priority,
        isLocked: purchaseRequests.isLocked,
        requester: {
          id: users.id,
          username: users.username,
          department: users.department,
          role: users.role,
        },
      })
      .from(purchaseRequests)
      .innerJoin(users, eq(users.id, purchaseRequests.requesterId))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(purchaseRequests.createdAt));

    return NextResponse.json(requests);
  } catch (error: any) {
    console.error("[Native API] Requests Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
