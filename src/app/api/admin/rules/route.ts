import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { VendorRuleEngineService } from "@/lib/services/VendorRuleEngineService";
import { db } from "@db";
import { vendorRulesetVersions, auditLogs } from "@db/schema";
import { desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const [rules, activeRuleset, allVersions] = await Promise.all([
      VendorRuleEngineService.getRuleDefinitions(),
      VendorRuleEngineService.getActiveRuleset(),
      db.select().from(vendorRulesetVersions).orderBy(desc(vendorRulesetVersions.versionNumber)),
    ]);

    return NextResponse.json({
      success: true,
      rules,
      activeRuleset,
      allVersions,
    });
  } catch (error: any) {
    console.error("Failed to fetch vendor rules:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch vendor rules" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "super_admin") {
      return NextResponse.json(
        { success: false, message: "Only Super Admins can configure compliance rules." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { ruleKey, name } = body;

    if (!ruleKey || !name) {
      return NextResponse.json(
        { success: false, message: "ruleKey and name are required." },
        { status: 400 }
      );
    }

    const savedRule = await VendorRuleEngineService.saveRuleDefinition(body, user.id);

    // Audit log
    await db.insert(auditLogs).values({
      userId: user.id,
      action: "VENDOR_RULE_SAVED",
      resourceType: "vendor_rule",
      resourceId: savedRule.id,
      details: { ruleKey: savedRule.ruleKey, name: savedRule.name, changes: body },
    });

    return NextResponse.json({ success: true, rule: savedRule });
  } catch (error: any) {
    console.error("Failed to save vendor rule:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to save vendor rule" },
      { status: 500 }
    );
  }
}
