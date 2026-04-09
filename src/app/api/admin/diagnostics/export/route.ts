import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { auditLogs, users } from "@db/schema";
import { eq, desc } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/diagnostics/export
 * Generates a diagnostic CSV export of system audit logs.
 * Access: Admin only.
 */
export async function GET(req: NextRequest) {
  try {
    const admin = await getAuthenticatedUser(req);
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: "Access denied. Admin only." }, { status: 403 });
    }

    // Fetch the last 1000 logs for the diagnostic report
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
      .limit(1000);

    // Generate CSV Content
    const headers = ["ID", "Timestamp", "User", "Action", "Resource Type", "Resource ID", "IP Address", "Details"];
    const rows = logs.map(log => [
      log.id,
      new Date(log.timestamp).toISOString(),
      log.user?.username || "System",
      log.action,
      log.resourceType || "N/A",
      log.resourceId || "N/A",
      log.ipAddress || "N/A",
      log.details ? JSON.stringify(log.details).replace(/"/g, '""') : ""
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="E3_Diagnostics_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error: any) {
    console.error("[Native Admin API] Diagnostics Export Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
