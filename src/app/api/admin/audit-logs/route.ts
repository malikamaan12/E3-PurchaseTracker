import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { auditLogs, users } from "@db/schema";
import { eq, desc } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/audit-logs
 * Fetch system-wide audit logs with user context.
 * Access: Admin only.
 */
export async function GET(req: NextRequest) {
  try {
    const admin = await getAuthenticatedUser(req);
    if (!admin) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    if (admin.role !== 'admin' && admin.role !== 'super_admin') {
      return NextResponse.json({ error: "Access denied. Admin only route." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    const logs = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        resourceId: auditLogs.resourceId,
        resourceType: auditLogs.resourceType,
        details: auditLogs.details,
        ipAddress: auditLogs.ipAddress,
        timestamp: auditLogs.timestamp,
        user: {
          username: users.username,
        }
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .orderBy(desc(auditLogs.timestamp))
      .limit(limit)
      .offset(offset);

    return NextResponse.json(logs);
  } catch (error: any) {
    console.error("[Native Admin API] Audit Logs GET Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
