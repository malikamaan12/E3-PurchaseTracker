import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { vendorComplianceCases, vendors, vendorOnboardingTokens, auditLogs } from "@db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";
import crypto from "crypto";

export const dynamic = "force-dynamic";

/**
 * GET /api/vendors/[id]/compliance-cases
 * List all compliance cases for a vendor.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id: vendorIdStr } = await params;
    const vendorId = parseInt(vendorIdStr);
    if (isNaN(vendorId)) {
      return NextResponse.json({ error: "Invalid vendor ID" }, { status: 400 });
    }

    const cases = await db
      .select()
      .from(vendorComplianceCases)
      .where(eq(vendorComplianceCases.vendorId, vendorId))
      .orderBy(desc(vendorComplianceCases.openedAt));

    return NextResponse.json({ success: true, cases });
  } catch (error: any) {
    console.error("[GET /api/vendors/[id]/compliance-cases] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch compliance cases" }, { status: 500 });
  }
}

/**
 * POST /api/vendors/[id]/compliance-cases
 * Open a new compliance case and generate a case-scoped portal invitation link.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const isAdmin = user.role === "admin" || user.role === "super_admin";
    if (!isAdmin) {
      return NextResponse.json({ error: "Only administrators can open compliance cases." }, { status: 403 });
    }

    const { id: vendorIdStr } = await params;
    const vendorId = parseInt(vendorIdStr);
    if (isNaN(vendorId)) {
      return NextResponse.json({ error: "Invalid vendor ID" }, { status: 400 });
    }

    const [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.id, vendorId))
      .limit(1);

    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    // Check for existing active case
    const [activeCase] = await db
      .select()
      .from(vendorComplianceCases)
      .where(and(
        eq(vendorComplianceCases.vendorId, vendorId),
        inArray(vendorComplianceCases.status, ["open", "under_review"])
      ))
      .limit(1);

    if (activeCase) {
      return NextResponse.json({ 
        error: `Vendor already has an active compliance case #${activeCase.caseNumber} (Status: ${activeCase.status}).` 
      }, { status: 409 });
    }

    const body = await req.json();
    const {
      reason,
      deadlineDays = 14,
      requiredDocuments = [],
      allowedFields = [],
      instructions,
    } = body;

    if (!reason) {
      return NextResponse.json({ error: "Reason for opening compliance case is required." }, { status: 400 });
    }

    const now = new Date();
    const deadline = new Date(now.getTime() + Number(deadlineDays) * 24 * 60 * 60 * 1000);
    const caseNumber = `CMP-${now.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // 1. Create Compliance Case
    const [newCase] = await db
      .insert(vendorComplianceCases)
      .values({
        vendorId,
        caseNumber,
        status: "open",
        reason,
        deadline,
        requiredDocuments: Array.isArray(requiredDocuments) ? requiredDocuments : [],
        allowedFields: Array.isArray(allowedFields) ? allowedFields : [],
        instructions: instructions || null,
        openedAt: now,
        openedBy: user.id,
      })
      .returning();

    // 2. Generate Single-Use Portal Token bound to this Case
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    await db.insert(vendorOnboardingTokens).values({
      vendorId,
      caseId: newCase.id,
      scope: "compliance_case",
      tokenHash,
      status: "active",
      expiresAt: deadline,
    });

    const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL || ""}/vendor-portal?token=${rawToken}`;

    // 3. Record Audit Log
    await db.insert(auditLogs).values({
      resourceType: "vendor",
      resourceId: vendorId,
      action: "COMPLIANCE_CASE_OPENED",
      userId: user.id,
      details: {
        caseId: newCase.id,
        caseNumber,
        reason,
        deadline: deadline.toISOString(),
        requiredDocuments,
      },
    });

    return NextResponse.json({
      success: true,
      case: newCase,
      portalUrl,
      rawToken,
      message: `Compliance case #${caseNumber} opened successfully.`,
    });
  } catch (error: any) {
    console.error("[POST /api/vendors/[id]/compliance-cases] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to create compliance case" }, { status: 500 });
  }
}
