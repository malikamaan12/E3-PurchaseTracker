import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { vendorOnboardingDrafts, vendorOnboardingTokens, vendorDocuments, users, vendorDraftCreationSchema } from "@db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { vendorOnboardingService } from "@/lib/services/VendorOnboardingService";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/vendors/drafts
 * Lists all vendor onboarding drafts.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const drafts = await db
      .select()
      .from(vendorOnboardingDrafts)
      .orderBy(desc(vendorOnboardingDrafts.createdAt));

    if (drafts.length === 0) {
      return NextResponse.json({ success: true, drafts: [] });
    }

    const draftIds = drafts.map((d) => d.id);

    // Fetch active tokens
    const tokens = await db
      .select()
      .from(vendorOnboardingTokens)
      .where(inArray(vendorOnboardingTokens.draftId, draftIds))
      .orderBy(desc(vendorOnboardingTokens.createdAt));

    // Fetch documents
    const documents = await db
      .select()
      .from(vendorDocuments)
      .where(inArray(vendorDocuments.draftId, draftIds));

    // Combine
    const populated = drafts.map((draft) => {
      const draftTokens = tokens.filter((t) => t.draftId === draft.id);
      const activeToken = draftTokens.find((t) => t.status === "active" && new Date(t.expiresAt) > new Date());
      const draftDocs = documents.filter((d) => d.draftId === draft.id);

      return {
        ...draft,
        documents: draftDocs,
        tokenSummary: {
          hasActiveToken: Boolean(activeToken),
          expiresAt: activeToken?.expiresAt || null,
          lastAccessedAt: activeToken?.lastAccessedAt || null,
          totalTokensGenerated: draftTokens.length,
        },
      };
    });

    return NextResponse.json({ success: true, drafts: populated });
  } catch (error: any) {
    const correlationId = crypto.randomUUID();
    console.error(`[VENDOR_DRAFTS_GET_ERROR:${correlationId}]`, error);
    return NextResponse.json(
      { error: `Unable to fetch drafts. Reference: ${correlationId}`, correlationId },
      { status: 500 }
    );
  }
}

/**
 * POST /api/vendors/drafts
 * Creates a minimal vendor draft and generates a 7-day onboarding link.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const canManage = user.role === "admin" || user.role === "super_admin" || (user as any).canManageVendors;
    if (!canManage) {
      return NextResponse.json({ error: "Unauthorized to manage vendors" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const parseResult = vendorDraftCreationSchema.safeParse(body);

    if (!parseResult.success) {
      const errMsg = parseResult.error.issues.map((i) => i.message).join(", ");
      return NextResponse.json({ error: errMsg }, { status: 400 });
    }

    const baseUrl = req.nextUrl.origin;
    const result = await vendorOnboardingService.createDraftAndInvitation({
      data: parseResult.data,
      userId: user.id,
      baseUrl,
    });

    return NextResponse.json({
      success: true,
      message: "Vendor onboarding invitation generated successfully.",
      ...result,
    });
  } catch (error: any) {
    const status = error.statusCode || 500;
    if (status >= 500) {
      const correlationId = crypto.randomUUID();
      console.error(`[VENDOR_INVITATION_ERROR:${correlationId}]`, {
        name: error?.name,
        message: error?.message,
        code: error?.code,
        stack: error?.stack,
        cause: error?.cause ? {
          name: (error.cause as any)?.name,
          message: (error.cause as any)?.message,
          code: (error.cause as any)?.code,
        } : undefined,
      });
      return NextResponse.json(
        {
          error: `Unable to create the vendor invitation. Please try again or contact the administrator. Reference: ${correlationId}`,
          correlationId,
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: error.message || "Failed to create draft" }, { status });
  }
}
