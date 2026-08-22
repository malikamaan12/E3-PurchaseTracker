import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { vendors, vendorOnboardingTokens, vendorPortalEvents } from "@db/schema";
import { db, transactionDb } from "@db";
import { eq, and, desc, gt, sql } from "drizzle-orm";
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
      return NextResponse.json({ success: false, error: "Unauthorized", message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const vendorId = parseInt(id, 10);
    if (isNaN(vendorId)) {
      return NextResponse.json({ success: false, error: "Invalid vendor ID", message: "Invalid vendor ID" }, { status: 400 });
    }

    const [vendor] = await db.select().from(vendors).where(eq(vendors.id, vendorId)).limit(1);
    if (!vendor) {
      return NextResponse.json({ success: false, error: "Vendor not found", message: "Vendor not found" }, { status: 404 });
    }

    // Retrieve active tokens metadata
    const activeTokens = await db
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
      .orderBy(desc(vendorOnboardingTokens.createdAt));

    const activeToken = activeTokens[0] || null;

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
      activeTokensCount: activeTokens.length,
      maxAllowed: MAX_ACTIVE_TOKENS_PER_VENDOR,
      tokenExpiresAt: activeToken?.expiresAt || null,
      isExpired: !activeToken,
      history,
    });
  } catch (error: any) {
    console.error("Failed to query completion link metadata:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to query link metadata", message: error.message || "Failed to query link metadata" },
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
      return NextResponse.json({ success: false, error: "Unauthorized", message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const vendorId = parseInt(id, 10);
    if (isNaN(vendorId)) {
      return NextResponse.json({ success: false, error: "Invalid vendor ID", message: "Invalid vendor ID" }, { status: 400 });
    }

    const [vendor] = await db.select().from(vendors).where(eq(vendors.id, vendorId)).limit(1);
    if (!vendor) {
      return NextResponse.json({ success: false, error: "Vendor not found", message: "Vendor not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || "generate"; // 'generate' | 'revoke' | 'log_event'

    // Action 1: Generate fresh independent 7-day token without evicting existing active tokens
    if (action === "generate") {
      // Per-user/vendor rate limiting (10 link generations per 60s window)
      const rateLimitKey = `link-gen:u:${user.id}:v:${vendorId}`;
      const rateCheck = await durableRateLimiter.consume(rateLimitKey, 10, 60, 1);
      if (!rateCheck.allowed) {
        return NextResponse.json(
          { success: false, error: "Rate limit exceeded", message: "Rate limit exceeded. Please wait before generating another link." },
          { status: 429 }
        );
      }

      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      try {
        // Execute vendor row locking, active-token limit enforcement, and event logging in one transaction
        await transactionDb.transaction(async (tx) => {
          // 1. Vendor-level transaction locking to prevent race conditions during concurrent generations
          await tx.execute(sql`SELECT id FROM ${vendors} WHERE ${vendors.id} = ${vendorId} FOR UPDATE`);

          // 2. Query currently active unexpired tokens
          const activeTokens = await tx
            .select({ id: vendorOnboardingTokens.id })
            .from(vendorOnboardingTokens)
            .where(
              and(
                eq(vendorOnboardingTokens.vendorId, vendorId),
                eq(vendorOnboardingTokens.status, "active"),
                gt(vendorOnboardingTokens.expiresAt, new Date())
              )
            );

          // 3. Strict cap enforcement: maximum 5 active links; 6th request returns 409 without invalidating existing links
          if (activeTokens.length >= MAX_ACTIVE_TOKENS_PER_VENDOR) {
            const limitErr = new Error("ACTIVE_TOKEN_LIMIT_REACHED");
            (limitErr as any).activeCount = activeTokens.length;
            throw limitErr;
          }

          // 4. Insert new active token
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

          // 5. Insert LINK_GENERATED event within same atomic transaction
          await tx.insert(vendorPortalEvents).values({
            vendorId,
            tokenId: tokenRecord.id,
            eventType: "LINK_GENERATED",
            actorId: user.id,
            actorType: "user",
            metadata: { rawTokenExpiresAt: tokenExpiresAt.toISOString() },
          });
        });
      } catch (txError: any) {
        if (txError?.message === "ACTIVE_TOKEN_LIMIT_REACHED") {
          return NextResponse.json(
            {
              success: false,
              error: `Active token limit reached. Maximum ${MAX_ACTIVE_TOKENS_PER_VENDOR} active links allowed per vendor.`,
              message: `Active token limit reached. Maximum ${MAX_ACTIVE_TOKENS_PER_VENDOR} active links allowed per vendor.`,
              activeTokensCount: txError.activeCount || MAX_ACTIVE_TOKENS_PER_VENDOR,
              maxAllowed: MAX_ACTIVE_TOKENS_PER_VENDOR,
            },
            { status: 409 }
          );
        }
        throw txError;
      }

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
          {
            success: false,
            error: "Forbidden: Only super administrators can revoke active completion links.",
            message: "Forbidden: Only super administrators can revoke active completion links.",
          },
          { status: 403 }
        );
      }

      await transactionDb.transaction(async (tx) => {
        // Lock vendor row during revocation
        await tx.execute(sql`SELECT id FROM ${vendors} WHERE ${vendors.id} = ${vendorId} FOR UPDATE`);

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
            error: `Invalid or unauthorized client event type. Allowed events: ${ALLOWED_CLIENT_EVENTS.join(", ")}`,
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

    return NextResponse.json({ success: false, error: "Invalid action", message: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Failed to process completion link request:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process completion link request", message: error.message || "Failed to process completion link request" },
      { status: 500 }
    );
  }
}

