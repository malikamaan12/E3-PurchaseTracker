import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { vendors, vendorOnboardingTokens, vendorPortalEvents, auditLogs } from "@db/schema";
import { db } from "@db";
import { eq, and, desc, gt } from "drizzle-orm";
import crypto from "crypto";

/**
 * GET /api/vendors/[id]/completion-link
 * 
 * Read-only endpoint for retrieving link status, token validity, and event history.
 * IDEMPOTENT: Does NOT create, rotate, or revoke tokens (safe for prefetching and caching).
 */
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const vendorId = parseInt(id, 10);
    if (isNaN(vendorId)) {
      return NextResponse.json({ success: false, message: "Invalid vendor ID" }, { status: 400 });
    }

    const [vendor] = await db.select().from(vendors).where(eq(vendors.id, vendorId)).limit(1);
    if (!vendor) {
      return NextResponse.json({ success: false, message: "Vendor not found" }, { status: 404 });
    }

    // Retrieve most recent active token metadata (without exposing raw token or hash)
    const [activeToken] = await db
      .select({
        id: vendorOnboardingTokens.id,
        status: vendorOnboardingTokens.status,
        expiresAt: vendorOnboardingTokens.expiresAt,
        createdAt: vendorOnboardingTokens.createdAt,
      })
      .from(vendorOnboardingTokens)
      .where(
        and(
          eq(vendorOnboardingTokens.vendorId, vendorId),
          eq(vendorOnboardingTokens.status, "active"),
          gt(vendorOnboardingTokens.expiresAt, new Date())
        )
      )
      .orderBy(desc(vendorOnboardingTokens.createdAt))
      .limit(1);

    // Retrieve link event history
    const history = await db
      .select({
        id: vendorPortalEvents.id,
        eventType: vendorPortalEvents.eventType,
        actorType: vendorPortalEvents.actorType,
        createdAt: vendorPortalEvents.createdAt,
      })
      .from(vendorPortalEvents)
      .where(eq(vendorPortalEvents.vendorId, vendorId))
      .orderBy(desc(vendorPortalEvents.createdAt))
      .limit(10);

    return NextResponse.json({
      success: true,
      vendorId,
      hasActiveToken: !!activeToken,
      tokenExpiresAt: activeToken?.expiresAt || null,
      isExpired: !activeToken,
      history,
    });
  } catch (error: any) {
    console.error("Failed to query completion link metadata:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to query link metadata" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/vendors/[id]/completion-link
 * 
 * State-mutating endpoint for generating fresh tokens, revoking tokens, or logging link interaction events.
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const vendorId = parseInt(id, 10);
    if (isNaN(vendorId)) {
      return NextResponse.json({ success: false, message: "Invalid vendor ID" }, { status: 400 });
    }

    const [vendor] = await db.select().from(vendors).where(eq(vendors.id, vendorId)).limit(1);
    if (!vendor) {
      return NextResponse.json({ success: false, message: "Vendor not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || "generate"; // 'generate' | 'revoke' | 'log_event'

    // Action 1: Generate fresh independent 7-day token without revoking previous active tokens
    if (action === "generate") {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      // Insert new active token (independent 7-day token; existing unexpired tokens remain valid)
      const [tokenRecord] = await db
        .insert(vendorOnboardingTokens)
        .values({
          vendorId,
          scope: "onboarding",
          tokenHash,
          status: "active",
          expiresAt: tokenExpiresAt,
        })
        .returning();

      const completionUrl = new URL("/vendor/onboard", req.nextUrl.origin);
      completionUrl.hash = `token=${rawToken}`;
      const completionLink = completionUrl.toString();

      // Log link generated event independently
      await db.insert(vendorPortalEvents).values({
        vendorId,
        tokenId: tokenRecord.id,
        eventType: "LINK_GENERATED",
        actorId: user.id,
        actorType: "user",
        metadata: { rawTokenExpiresAt: tokenExpiresAt.toISOString() },
      });

      return NextResponse.json({
        success: true,
        vendorId,
        completionLink,
        expiresAt: tokenExpiresAt,
      });
    }

    // Action 2: Revoke active link tokens
    if (action === "revoke") {
      await db
        .update(vendorOnboardingTokens)
        .set({ status: "revoked", revokedAt: new Date(), revokedBy: user.id })
        .where(
          and(
            eq(vendorOnboardingTokens.vendorId, vendorId),
            eq(vendorOnboardingTokens.status, "active")
          )
        );

      await db.insert(vendorPortalEvents).values({
        vendorId,
        eventType: "LINK_REVOKED",
        actorId: user.id,
        actorType: "user",
        metadata: { reason: body.reason || "Manual revocation by user" },
      });

      return NextResponse.json({ success: true, message: "Active completion links revoked." });
    }

    // Action 3: Log user interaction event (e.g. LINK_COPIED, LINK_SENT_EMAIL)
    if (action === "log_event") {
      const eventType = body.eventType || "LINK_COPIED";
      await db.insert(vendorPortalEvents).values({
        vendorId,
        eventType,
        actorId: user.id,
        actorType: "user",
        metadata: body.metadata || {},
      });

      return NextResponse.json({ success: true, loggedEvent: eventType });
    }

    return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Failed to process completion link request:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to process completion link request" },
      { status: 500 }
    );
  }
}
