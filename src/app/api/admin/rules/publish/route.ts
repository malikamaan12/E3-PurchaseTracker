import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { VendorRuleEngineService } from "@/lib/services/VendorRuleEngineService";
import { db } from "@db";
import { auditLogs } from "@db/schema";

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "super_admin") {
      return NextResponse.json(
        { success: false, message: "Only Super Admins can publish ruleset versions." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { rulesetVersionId, changeSummary, applyToExistingVendors } = body;

    let targetId = rulesetVersionId;
    if (!targetId) {
      // Create new draft from current rules and publish it
      const draft = await VendorRuleEngineService.createRulesetDraft(changeSummary || "New Ruleset Publication", user.id);
      targetId = draft.id;
    }

    const published = await VendorRuleEngineService.publishRuleset(
      targetId,
      changeSummary || "Published ruleset version",
      user.id,
      !!applyToExistingVendors
    );

    // Audit log
    await db.insert(auditLogs).values({
      userId: user.id,
      action: "RULESET_PUBLISHED",
      resourceType: "vendor_ruleset_version",
      resourceId: published.id,
      details: {
        versionNumber: published.versionNumber,
        changeSummary: published.changeSummary,
        applyToExistingVendors: !!applyToExistingVendors,
      },
    });

    return NextResponse.json({ success: true, publishedRuleset: published });
  } catch (error: any) {
    console.error("Failed to publish ruleset:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to publish ruleset" },
      { status: 500 }
    );
  }
}
