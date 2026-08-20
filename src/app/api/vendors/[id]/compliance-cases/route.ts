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

    const caseIds = cases.map((c) => c.id);
    let tokens: any[] = [];
    if (caseIds.length > 0) {
      tokens = await db
        .select()
        .from(vendorOnboardingTokens)
        .where(and(
          eq(vendorOnboardingTokens.vendorId, vendorId),
          inArray(vendorOnboardingTokens.caseId, caseIds)
        ))
        .orderBy(desc(vendorOnboardingTokens.createdAt));
    }

    const populatedCases = cases.map((c) => {
      const caseTokens = tokens.filter((t) => t.caseId === c.id);
      const activeToken = caseTokens.find((t) => t.status === "active" && new Date(t.expiresAt) > new Date());
      return {
        ...c,
        activeToken: activeToken ? {
          id: activeToken.id,
          expiresAt: activeToken.expiresAt,
          status: activeToken.status,
          lastAccessedAt: activeToken.lastAccessedAt,
        } : null,
      };
    });

    return NextResponse.json({ success: true, cases: populatedCases });
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

    const isAdmin = user.role === "admin" || user.role === "super_admin" || (user as any).canManageVendors;
    if (!isAdmin) {
      return NextResponse.json({ error: "Only administrators can open compliance cases or request vendor updates." }, { status: 403 });
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

    const body = await req.json().catch(() => ({}));
    const {
      reason = "information_update",
      deadlineDays = 15,
      requiredDocuments = [],
      allowedFields = [],
      instructions,
      forceNew = false,
    } = body;

    // Check for existing active case
    const [activeCase] = await db
      .select()
      .from(vendorComplianceCases)
      .where(and(
        eq(vendorComplianceCases.vendorId, vendorId),
        inArray(vendorComplianceCases.status, ["open", "under_review"])
      ))
      .limit(1);

    if (activeCase && !forceNew) {
      // If forceNew is false, revoke any old token and generate a fresh one for the existing case, or return conflict
      // When requested through update link modal, forceNew or regeneration creates a fresh link
      // Let's revoke previous active tokens for this case and issue a new token!
      await db
        .update(vendorOnboardingTokens)
        .set({ status: "revoked", revokedAt: new Date() })
        .where(and(
          eq(vendorOnboardingTokens.vendorId, vendorId),
          eq(vendorOnboardingTokens.caseId, activeCase.id),
          eq(vendorOnboardingTokens.status, "active")
        ));

      const now = new Date();
      const deadline = new Date(now.getTime() + Math.max(1, Number(deadlineDays)) * 24 * 60 * 60 * 1000);
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

      await db.insert(vendorOnboardingTokens).values({
        vendorId,
        caseId: activeCase.id,
        scope: "compliance_case",
        tokenHash,
        status: "active",
        expiresAt: deadline,
      });

      // Update case instructions / allowedFields / requiredDocs if provided
      if (allowedFields.length > 0 || requiredDocuments.length > 0 || instructions) {
        await db
          .update(vendorComplianceCases)
          .set({
            allowedFields: allowedFields.length > 0 ? allowedFields : activeCase.allowedFields,
            requiredDocuments: requiredDocuments.length > 0 ? requiredDocuments : activeCase.requiredDocuments,
            instructions: instructions || activeCase.instructions,
            deadline,
          })
          .where(eq(vendorComplianceCases.id, activeCase.id));
      }

      const baseUrl = req.nextUrl.origin;
      const portalUrl = `${baseUrl}/vendor/onboard#token=${rawToken}`;
      const mailtoSubject = encodeURIComponent(`Update Request: ${vendor.companyName} Procurement Profile`);
      const mailtoBody = encodeURIComponent(
        `Dear ${vendor.contactPerson || vendor.companyName},\n\nPlease use the following secure link to review and update your vendor profile and compliance documents:\n\n${portalUrl}\n\nThis secure update link is valid for 24 hours.\n\nThank you,\nProcurement Team`
      );
      const mailtoUrl = `mailto:${vendor.email || ""}?subject=${mailtoSubject}&body=${mailtoBody}`;

      return NextResponse.json({
        success: true,
        case: activeCase,
        portalUrl,
        rawToken,
        mailtoUrl,
        expiresAt: deadline,
        message: `New update link generated for case #${activeCase.caseNumber}.`,
      });
    }

    if (activeCase && forceNew) {
      // Close old case and revoke old tokens
      await db
        .update(vendorComplianceCases)
        .set({ status: "closed", closedAt: new Date() })
        .where(eq(vendorComplianceCases.id, activeCase.id));

      await db
        .update(vendorOnboardingTokens)
        .set({ status: "revoked", revokedAt: new Date() })
        .where(and(
          eq(vendorOnboardingTokens.vendorId, vendorId),
          eq(vendorOnboardingTokens.status, "active")
        ));
    }

    const now = new Date();
    const deadline = new Date(now.getTime() + Math.max(1, Number(deadlineDays)) * 24 * 60 * 60 * 1000);
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

    const baseUrl = req.nextUrl.origin;
    const portalUrl = `${baseUrl}/vendor/onboard#token=${rawToken}`;
    const mailtoSubject = encodeURIComponent(`Update Request: ${vendor.companyName} Procurement Profile`);
    const mailtoBody = encodeURIComponent(
      `Dear ${vendor.contactPerson || vendor.companyName},\n\nPlease use the following secure link to review and update your vendor profile and compliance documents:\n\n${portalUrl}\n\nThis secure update link is valid for 24 hours.\n\nThank you,\nProcurement Team`
    );
    const mailtoUrl = `mailto:${vendor.email || ""}?subject=${mailtoSubject}&body=${mailtoBody}`;

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
        allowedFields,
      },
    });

    return NextResponse.json({
      success: true,
      case: newCase,
      portalUrl,
      rawToken,
      mailtoUrl,
      expiresAt: deadline,
      message: `Update link and compliance case #${caseNumber} created successfully.`,
    });
  } catch (error: any) {
    console.error("[POST /api/vendors/[id]/compliance-cases] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to create compliance case" }, { status: 500 });
  }
}

/**
 * DELETE /api/vendors/[id]/compliance-cases
 * Revokes the active token and optionally closes active compliance cases for this vendor.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const isAdmin = user.role === "admin" || user.role === "super_admin" || (user as any).canManageVendors;
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id: vendorIdStr } = await params;
    const vendorId = parseInt(vendorIdStr);
    if (isNaN(vendorId)) {
      return NextResponse.json({ error: "Invalid vendor ID" }, { status: 400 });
    }

    await db
      .update(vendorOnboardingTokens)
      .set({ status: "revoked", revokedAt: new Date() })
      .where(and(
        eq(vendorOnboardingTokens.vendorId, vendorId),
        eq(vendorOnboardingTokens.status, "active")
      ));

    await db.insert(auditLogs).values({
      resourceType: "vendor",
      resourceId: vendorId,
      action: "COMPLIANCE_LINK_REVOKED",
      userId: user.id,
      details: { timestamp: new Date().toISOString() },
    });

    return NextResponse.json({
      success: true,
      message: "Active update link revoked successfully.",
    });
  } catch (error: any) {
    console.error("[DELETE /api/vendors/[id]/compliance-cases] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to revoke link" }, { status: 500 });
  }
}
