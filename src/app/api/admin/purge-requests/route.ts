import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { purchaseRequests, users, auditLogs } from "@db/schema";
import { eq } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/purge-requests
 * Dangerous operation to wipe all purchase requests before system go-live.
 * Requires Admin role and password re-verification.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. JWT Authentication
    const admin = await getAuthenticatedUser(req);
    if (!admin || admin.role.toLowerCase() !== "admin") {
      return NextResponse.json({ error: "Unauthorized. Institutional Admin access required." }, { status: 403 });
    }

    const { password } = await req.json();
    if (!password) {
      return NextResponse.json({ error: "Password confirmation required for destructive actions." }, { status: 400 });
    }

    // 2. Password Verification
    // Fetch the fresh hash from DB to ensure we are comparing against current credentials
    const [dbUser] = await db.select().from(users).where(eq(users.id, admin.id)).limit(1);
    
    if (!dbUser) {
      return NextResponse.json({ error: "Security identity disruption. Admin record not found." }, { status: 404 });
    }

    const isMatch = await bcrypt.compare(password, dbUser.password);
    if (!isMatch) {
      return NextResponse.json({ error: "Institutional verification failed. Invalid password." }, { status: 401 });
    }

    // 3. Execution (Cascading Deletes)
    // Drizzle will execute the DELETE, and Postgres will handle the cascade based on schema constraints.
    const result = await db.delete(purchaseRequests);

    // 4. Audit Logging
    await db.insert(auditLogs).values({
      userId: admin.id,
      action: "PURGE_ALL_REQUESTS",
      resourceType: "purchase_request",
      details: {
        message: "Danger Zone Purge: All procurement data wiped.",
        timestamp: new Date().toISOString(),
      },
      ipAddress: req.headers.get("x-forwarded-for") || "unknown",
      userAgent: req.headers.get("user-agent") || "unknown",
    });

    console.log(`[DANGER_ZONE] Institutional Purge executed by Admin ID: ${admin.id}`);

    return NextResponse.json({ 
      success: true, 
      message: "System purged successfully. All procurement data has been wiped." 
    });

  } catch (error: any) {
    console.error("[DANGER_ZONE] Purge Error:", error);
    return NextResponse.json({ 
      error: "Internal Server Error", 
      message: error.message 
    }, { status: 500 });
  }
}
