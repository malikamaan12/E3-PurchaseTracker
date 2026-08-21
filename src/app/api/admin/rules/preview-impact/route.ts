import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { VendorRuleEngineService } from "@/lib/services/VendorRuleEngineService";

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "super_admin" && user.role !== "admin") {
      return NextResponse.json(
        { success: false, message: "Only Admins and Super Admins can simulate ruleset impact." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { targetVersionId } = body;

    let targetId = targetVersionId;
    if (!targetId) {
      const active = await VendorRuleEngineService.getActiveRuleset();
      targetId = active.id;
    }

    const preview = await VendorRuleEngineService.previewImpact(targetId);

    return NextResponse.json({ success: true, preview });
  } catch (error: any) {
    console.error("Failed to preview ruleset impact:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to preview ruleset impact" },
      { status: 500 }
    );
  }
}
