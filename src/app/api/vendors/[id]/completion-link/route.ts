import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { vendors, vendorOnboardingTokens, vendorPortalEvents, auditLogs } from "@db/schema";
import { db, transactionDb } from "@db";
import { eq, and, desc, gt } from "drizzle-orm";
import crypto from "crypto";
import { durableRateLimiter } from "@/lib/services/DurableRateLimitService";

const ALLOWED_CLIENT_EVENTS = ["LINK_COPIED", "LINK_SENT_EMAIL", "REMINDER_SENT"] as const;
const MAX_ACTIVE_TOKENS_PER_VENDOR = 5;

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
      // Per-user/vendor rate limiting (10 link generations per 60s window)
      const rateLimitKey = `link-gen:u:${user.id}:v:${vendorId}`;
      const rateCheck = await durableRateLimiter.consume(rateLimitKey, 10, 60, 1);
      if (!rateCheck.allowed) {
        return NextResponse.json(
          { success: false, message: "Rate limit exceeded. Please wait before generating another link." },
          { status: 429 }
        );
      }

      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      // Execute token insertion, active-token limit enforcement, and event logging in one transaction
      await transactionDb.transaction(async (tx) => {
        // Enforce active token limit per vendor
        const activeTokens = await tx
          .select({ id: vendorOnboardingTokens.id })
          .from(vendorOnboardingTokens)
          .where(
            and(
              eq(vendorOnboardingTokens.vendorId, vendorId),
              eq(vendorOnboardingTokens.status, "active"),
              gt(vendorOnboardingTokens.expiresAt, new Date())
            )
          )
          .orderBy(vendorOnboardingTokens.createdAt);

        if (activeTokens.length >= MAX_ACTIVE_TOKENS_PER_VENDOR) {
          const oldestToken = activeTokens[0];
          await tx
            .update(vendorOnboardingTokens)
            .set({ status: "expired" })
            .where(eq(vendorOnboardingTokens.id, oldestToken.id));
        }

        // Insert new active token
        const [tokenRecord] = await tx
          .insert(vendorOnboardingTokens)
          .values({
            vendorId,
            scope: "onboarding",
            tokenHash,
            status: "active",
            expiresAt: tokenExpiresAt,
          })
          .returning();

        // Insert LINK_GENERATED event within same atomic transaction
        await tx.insert(vendorPortalEvents).values({
          vendorId,
          tokenId: tokenRecord.id,
          eventType: "LINK_GENERATED",
          actorId: user.id,
          actorType: "user",
          metadata: { rawTokenExpiresAt: tokenExpiresAt.toISOString() },
        });
      });

      const completionUrl = new URL("/vendor/onboard", req.nextUrl.origin);
      completionUrl.hash = `token=${rawToken}`;
      const completionLink = completionUrl.toString();

      return NextResponse.json({
        success: true,
        vendorId,
        completionLink,
        expiresAt: tokenExpiresAt,
      });
    }

    // Action 2: Revoke active link tokens (Strictly restricted to super_admin)
    if (action === "revoke") {
      if (user.role !== "super_admin") {
        return NextResponse.json(
          { success: false, message: "Forbidden: Only administrators can revoke active completion links." },
          { status: 403 }
        );
      }

      await transactionDb.transaction(async (tx) => {
        await tx
          .update(vendorOnboardingTokens)
          .set({ status: "revoked", revokedAt: new Date(), revokedBy: user.id })
          .where(
            and(
              eq(vendorOnboardingTokens.vendorId, vendorId),
              eq(vendorOnboardingTokens.status, "active")
            )
          );

        await tx.insert(vendorPortalEvents).values({
          vendorId,
          eventType: "LINK_REVOKED",
          actorId: user.id,
          actorType: "user",
          metadata: { reason: body.reason || "Manual revocation by administrator" },
        });
      });

      return NextResponse.json({ success: true, message: "Active completion links revoked." });
    }

    // Action 3: Log user interaction event (Restricted to whitelisted client events)
    if (action === "log_event") {
      const eventType = body.eventType;
      if (!eventType || !(ALLOWED_CLIENT_EVENTS as readonly string[]).includes(eventType)) {
        return NextResponse.json(
          {
            success: false,
            message: `Invalid or unauthorized client event type. Allowed events: ${ALLOWED_CLIENT_EVENTS.join(", ")}`,
          },
          { status: 400 }
        );
      }

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
