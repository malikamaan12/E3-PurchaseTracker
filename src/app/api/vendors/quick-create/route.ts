import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { vendorQuickCreateSchema, vendors, vendorOnboardingTokens, vendorPortalEvents, auditLogs } from "@db/schema";
import { db } from "@db";
import { VendorRuleEngineService } from "@/lib/services/VendorRuleEngineService";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = vendorQuickCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Validation error", errors: parsed.error.format() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Compute deadline
    let deadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // default 30d
    if (data.deadlineOption === "7") {
      deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    } else if (data.deadlineOption === "14") {
      deadline = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    } else if (data.deadlineOption === "30") {
      deadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    } else if (data.deadlineOption === "custom" && data.customDeadline) {
      const parsedCustom = new Date(data.customDeadline);
      if (!isNaN(parsedCustom.getTime())) {
        deadline = parsedCustom;
      }
    }

    const activeRuleset = await VendorRuleEngineService.getActiveRuleset();

    // 1. Insert live active vendor
    const [newVendor] = await db
      .insert(vendors)
      .values({
        companyName: data.companyName,
        contactPerson: data.contactPerson,
        contactNumber: data.contactNumber,
        email: data.email,
        address: data.address || "Doha, Qatar",
        vendorType: data.vendorType,
        engagementType: data.engagementType,
        complianceStatus: "unassessed",
        complianceScore: 0,
        complianceDeadline: deadline,
        rulesetVersionId: activeRuleset.id,
        bankingVerificationStatus: "unverified",
        creatorId: user.id,
        status: "active",
        onboardingStatus: "approved", // Live and usable in PRs immediately
        payment_currency: data.payment_currency || "QAR",
        category: data.category || "general",
        remarks: data.remarks,
      })
      .returning();

    // 2. Assign requirements from active ruleset
    const assignedRequirements = await VendorRuleEngineService.assignRequirementsToVendor(
      newVendor.id,
      (data.vendorType === "freelancer" ? "freelancer" : "company") as "company" | "freelancer",
      deadline,
      user.id,
      body.customOverrides
    );

    // 3. Generate 7-day portal bearer token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days token

    const [tokenRecord] = await db
      .insert(vendorOnboardingTokens)
      .values({
        vendorId: newVendor.id,
        scope: "onboarding",
        tokenHash,
        status: "active",
        expiresAt: tokenExpiresAt,
      })
      .returning();

    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
    const proto = req.headers.get("x-forwarded-proto") || "http";
    const completionLink = `${proto}://${host}/vendor/onboard#token=${rawToken}`;

    // 4. Log portal event
    await db.insert(vendorPortalEvents).values({
      vendorId: newVendor.id,
      tokenId: tokenRecord.id,
      eventType: "LINK_GENERATED",
      actorId: user.id,
      actorType: "user",
      metadata: { rawTokenExpiresAt: tokenExpiresAt.toISOString() },
    });

    // 5. Audit log
    await db.insert(auditLogs).values({
      userId: user.id,
      action: "VENDOR_QUICK_CREATED",
      resourceType: "vendor",
      resourceId: newVendor.id,
      details: {
        companyName: newVendor.companyName,
        vendorType: newVendor.vendorType,
        engagementType: newVendor.engagementType,
        complianceDeadline: deadline.toISOString(),
        assignedCount: assignedRequirements.length,
      },
    });

    return NextResponse.json({
      success: true,
      vendor: newVendor,
      assignedRequirements,
      token: rawToken,
      completionLink,
    });
  } catch (error: any) {
    console.error("Failed to quick-create vendor:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to create vendor" },
      { status: 500 }
    );
  }
}
