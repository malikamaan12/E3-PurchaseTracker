import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { vendors, vendorOnboardingTokens, vendorPortalEvents, auditLogs } from "@db/schema";
import { db } from "@db";
import { eq, and, gt } from "drizzle-orm";
import crypto from "crypto";

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

    // Generate fresh 7-day token without changing vendor deadline or creation date
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Revoke existing active tokens for this vendor
    await db
      .update(vendorOnboardingTokens)
      .set({ status: "revoked", revokedAt: new Date(), revokedBy: user.id })
      .where(
        and(
          eq(vendorOnboardingTokens.vendorId, vendorId),
          eq(vendorOnboardingTokens.status, "active")
        )
      );

    // Insert new active token
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

    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
    const proto = req.headers.get("x-forwarded-proto") || "http";
    const completionLink = `${proto}://${host}/vendor/onboard#token=${rawToken}`;

    // Log event
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
  } catch (error: any) {
    console.error("Failed to generate completion link:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to generate link" },
      { status: 500 }
    );
  }
}

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

    const body = await req.json();
    const eventType = body.eventType || "LINK_COPIED"; // 'LINK_COPIED' | 'LINK_SENT_EMAIL' | 'REMINDER_SENT'

    await db.insert(vendorPortalEvents).values({
      vendorId,
      eventType,
      actorId: user.id,
      actorType: "user",
      metadata: body.metadata || {},
    });

    return NextResponse.json({ success: true, loggedEvent: eventType });
  } catch (error: any) {
    console.error("Failed to log link event:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to log event" },
      { status: 500 }
    );
  }
}
