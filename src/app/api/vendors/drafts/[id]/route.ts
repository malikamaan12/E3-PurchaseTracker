import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { vendorOnboardingDrafts, vendorOnboardingTokens, vendorDocuments, auditLogs } from "@db/schema";
import { eq, desc, and } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { id } = await params;
    const draftId = parseInt(id, 10);
    if (isNaN(draftId)) return NextResponse.json({ error: "Invalid draft ID" }, { status: 400 });

    const [draft] = await db
      .select()
      .from(vendorOnboardingDrafts)
      .where(eq(vendorOnboardingDrafts.id, draftId))
      .limit(1);

    if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });

    const documents = await db
      .select()
      .from(vendorDocuments)
      .where(eq(vendorDocuments.draftId, draftId))
      .orderBy(desc(vendorDocuments.uploadedAt));

    const tokens = await db
      .select({
        id: vendorOnboardingTokens.id,
        status: vendorOnboardingTokens.status,
        expiresAt: vendorOnboardingTokens.expiresAt,
        lastAccessedAt: vendorOnboardingTokens.lastAccessedAt,
        submittedAt: vendorOnboardingTokens.submittedAt,
        revokedAt: vendorOnboardingTokens.revokedAt,
        createdAt: vendorOnboardingTokens.createdAt,
      })
      .from(vendorOnboardingTokens)
      .where(eq(vendorOnboardingTokens.draftId, draftId))
      .orderBy(desc(vendorOnboardingTokens.createdAt));

    const logs = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.resourceId, draftId), eq(auditLogs.resourceType, "vendor_onboarding_draft")))
      .orderBy(desc(auditLogs.timestamp))
      .limit(20);

    return NextResponse.json({
      success: true,
      draft,
      documents,
      tokens,
      auditLogs: logs,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch draft" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const canManage = user.role === "admin" || user.role === "super_admin" || (user as any).canManageVendors;
    if (!canManage) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const { id } = await params;
    const draftId = parseInt(id, 10);
    if (isNaN(draftId)) return NextResponse.json({ error: "Invalid draft ID" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const { category, notes, requiredDocumentTypes } = body;

    const [updated] = await db
      .update(vendorOnboardingDrafts)
      .set({
        category: category || undefined,
        onboardingNotes: notes !== undefined ? notes : undefined,
        requiredDocumentTypes: requiredDocumentTypes || undefined,
        updatedAt: new Date(),
      })
      .where(eq(vendorOnboardingDrafts.id, draftId))
      .returning();

    return NextResponse.json({ success: true, draft: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update draft" }, { status: 500 });
  }
}
