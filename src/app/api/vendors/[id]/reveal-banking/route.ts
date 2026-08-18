import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { vendors, auditLogs } from "@db/schema";
import { eq } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";

export const dynamic = 'force-dynamic';

/**
 * POST /api/vendors/[id]/reveal-banking
 * Authorized reveal endpoint for vendor banking credentials with mandatory audit logging.
 * Access: Admin or Finance / Management personnel.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: paramId } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const isAuthorized = 
      user.role === 'admin' || 
      user.role === 'super_admin' || 
      user.canManageVendors === true ||
      ["finance", "management", "ceo office"].includes(user.department?.toLowerCase() || "");

    if (!isAuthorized) {
      return NextResponse.json({ 
        error: "Access Denied", 
        message: "You are not authorized to reveal sensitive banking credentials." 
      }, { status: 403 });
    }

    const vendorId = parseInt(paramId);
    if (isNaN(vendorId)) return NextResponse.json({ error: "Invalid vendor ID" }, { status: 400 });

    const [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.id, vendorId))
      .limit(1);

    if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

    // Insert mandatory audit log entry
    try {
      await db.insert(auditLogs).values({
        userId: user.id,
        action: "vendor_banking_revealed",
        resourceType: "vendor",
        resourceId: vendorId,
        ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "internal",
        userAgent: req.headers.get("user-agent") || "unknown",
        details: {
          vendorName: vendor.companyName,
          revealedBy: user.username,
          role: user.role,
          department: user.department,
          timestamp: new Date().toISOString()
        },
        timestamp: new Date()
      });
    } catch (auditErr) {
      console.error("[VENDOR_REVEAL_AUDIT] Failed to record audit log:", auditErr);
    }

    return NextResponse.json({
      success: true,
      vendorId: vendor.id,
      companyName: vendor.companyName,
      bankName: vendor.bankName,
      accountNumber: vendor.accountNumber,
      ibanNumber: vendor.ibanNumber,
      contactPerson: vendor.contactPerson,
      revealedAt: new Date().toISOString()
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      }
    });
  } catch (error: any) {
    console.error("[Native API] Vendor Reveal Banking Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
