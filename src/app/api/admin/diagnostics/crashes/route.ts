import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { errorLogs, users } from "@db/schema";
import { eq, desc, and } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/diagnostics/crashes
 * List recorded crash incidents for Super Admins.
 */
export async function GET(req: NextRequest) {
  try {
    const admin = await getAuthenticatedUser(req);
    if (!admin) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (admin.role !== "super_admin" && admin.role !== "admin") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const crashes = await db
      .select({
        id: errorLogs.id,
        message: errorLogs.message,
        code: errorLogs.code,
        severity: errorLogs.severity,
        path: errorLogs.path,
        details: errorLogs.details,
        createdAt: errorLogs.createdAt,
        user: {
          username: users.username,
          department: users.department,
        },
      })
      .from(errorLogs)
      .leftJoin(users, eq(errorLogs.userId, users.id))
      .orderBy(desc(errorLogs.createdAt))
      .limit(50);

    return NextResponse.json(crashes);
  } catch (error: any) {
    console.error("[Diagnostics Crashes GET Error]:", error);
    return NextResponse.json({ error: "Failed to fetch crashes", details: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/diagnostics/crashes
 * Clear or resolve all crash logs.
 */
export async function DELETE(req: NextRequest) {
  try {
    const admin = await getAuthenticatedUser(req);
    if (!admin) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (admin.role !== "super_admin") {
      return NextResponse.json({ error: "Access denied. Super Admin only." }, { status: 403 });
    }

    await db.delete(errorLogs);

    return NextResponse.json({ success: true, message: "All crash incidents cleared." });
  } catch (error: any) {
    console.error("[Diagnostics Crashes DELETE Error]:", error);
    return NextResponse.json({ error: "Failed to clear crashes", details: error.message }, { status: 500 });
  }
}
