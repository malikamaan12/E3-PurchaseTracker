import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { vendors } from "@db/schema";
import { desc } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";

export const dynamic = 'force-dynamic';

/**
 * Compliance Status API
 * Aggregates vendor document coverage by pulling pre-calculated scores from the DB.
 * Access: super_admin, admin, approver
 */
export async function GET(req: NextRequest) {
  try {
    // 1. Auth Guard (Super Admin, Admin, Approver)
    const user = await getAuthenticatedUser(req);

    if (!user || (user.role !== "admin" && user.role !== "super_admin" && user.role !== "approver")) {
      return NextResponse.json({ error: "Unauthorized access to compliance vault" }, { status: 403 });
    }

    // 2. Fetch all active vendors with pre-calculated scores
    const allVendors = await db.select().from(vendors).orderBy(desc(vendors.createdAt));

    // 3. Map to UI structure
    const matrix = allVendors.map((v) => ({
      id: v.id,
      companyName: v.companyName,
      registrationNumber: v.registrationNumber,
      taxNumber: v.taxNumber,
      status: v.status,
      healthScore: v.complianceScore || 0,
      docs: (v.complianceMetadata as any) || {
        registration: { status: "missing", file: null },
        tax: { status: "missing", file: null },
        establishment: { status: "missing", file: null },
        contract: { status: "missing", file: null },
      }
    }));

    // 4. Global Stats
    const totalVendors = matrix.length;
    const fullyCompliant = matrix.filter(m => m.healthScore === 100).length;
    const highRisk = matrix.filter(m => m.healthScore < 50).length;

    return NextResponse.json({
      summary: {
        totalVendors,
        fullyCompliant,
        highRisk,
        systemHealth: Math.round((fullyCompliant / (totalVendors || 1)) * 100)
      },
      vendors: matrix
    });

  } catch (error: any) {
    console.error("[COMPLIANCE_API] Internal Error:", error);
    return NextResponse.json({ 
      error: "Failed to load legal matrix",
      details: error.message 
    }, { status: 500 });
  }
}
