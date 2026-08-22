import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { vendorComplianceSettings, auditLogs } from "@db/schema";
import { eq } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const [settings] = await db
      .select()
      .from(vendorComplianceSettings)
      .limit(1);

    if (!settings) {
      // Seed default singleton
      const [seeded] = await db
        .insert(vendorComplianceSettings)
        .values({
          id: 1,
          isSingleton: true,
          defaultGraceDays: 15,
          expirationWarningDays: 30,
          companyChecklist: ["CR", "TAX_CARD", "ESTABLISHMENT_ID"],
          freelancerChecklist: [],
          allowFreelancerCashExemption: true,
          reminderThresholdDays: [30, 15, 7, 1],
          updatedBy: user.id,
        })
        .returning();

      return NextResponse.json({ success: true, settings: seeded });
    }

    return NextResponse.json({ success: true, settings });
  } catch (error: any) {
    console.error("Failed to fetch compliance settings:", error);
    return NextResponse.json({ success: false, message: error.message || "Failed to fetch settings" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const role = user.role?.toLowerCase() || "";
    if (role !== "super_admin" && role !== "superadmin") {
      return NextResponse.json({ success: false, message: "Only Super Admins can modify global compliance settings." }, { status: 403 });
    }

    const body = await req.json();
    const {
      defaultGraceDays,
      expirationWarningDays,
      companyChecklist,
      freelancerChecklist,
      allowFreelancerCashExemption,
      reminderThresholdDays,
    } = body;

    if (defaultGraceDays !== undefined && (defaultGraceDays < 1 || defaultGraceDays > 365)) {
      return NextResponse.json({ success: false, message: "Default grace period must be between 1 and 365 days." }, { status: 400 });
    }

    if (expirationWarningDays !== undefined && (expirationWarningDays < 1 || expirationWarningDays > 180)) {
      return NextResponse.json({ success: false, message: "Expiration warning period must be between 1 and 180 days." }, { status: 400 });
    }

    const [current] = await db
      .select()
      .from(vendorComplianceSettings)
      .limit(1);

    const updatePayload: Record<string, any> = {
      updatedBy: user.id,
      updatedAt: new Date(),
    };

    if (defaultGraceDays !== undefined) updatePayload.defaultGraceDays = defaultGraceDays;
    if (expirationWarningDays !== undefined) updatePayload.expirationWarningDays = expirationWarningDays;
    if (companyChecklist !== undefined) updatePayload.companyChecklist = companyChecklist;
    if (freelancerChecklist !== undefined) updatePayload.freelancerChecklist = freelancerChecklist;
    if (allowFreelancerCashExemption !== undefined) updatePayload.allowFreelancerCashExemption = allowFreelancerCashExemption;
    if (reminderThresholdDays !== undefined) updatePayload.reminderThresholdDays = reminderThresholdDays;

    let updatedRecord;
    if (!current) {
      [updatedRecord] = await db
        .insert(vendorComplianceSettings)
        .values({
          id: 1,
          isSingleton: true,
          defaultGraceDays: defaultGraceDays ?? 15,
          expirationWarningDays: expirationWarningDays ?? 30,
          companyChecklist: companyChecklist ?? ["CR", "TAX_CARD", "ESTABLISHMENT_ID"],
          freelancerChecklist: freelancerChecklist ?? [],
          allowFreelancerCashExemption: allowFreelancerCashExemption ?? true,
          reminderThresholdDays: reminderThresholdDays ?? [30, 15, 7, 1],
          updatedBy: user.id,
        })
        .returning();
    } else {
      [updatedRecord] = await db
        .update(vendorComplianceSettings)
        .set(updatePayload)
        .where(eq(vendorComplianceSettings.id, current.id))
        .returning();
    }

    // Create before/after audit log
    await db.insert(auditLogs).values({
      resourceType: "system_settings",
      resourceId: 1,
      action: "UPDATE_COMPLIANCE_SETTINGS",
      userId: user.id,
      details: {
        before: current,
        after: updatedRecord,
        changedBy: user.username || `User #${user.id}`,
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json({ success: true, settings: updatedRecord });
  } catch (error: any) {
    console.error("Failed to update compliance settings:", error);
    return NextResponse.json({ success: false, message: error.message || "Failed to update settings" }, { status: 500 });
  }
}
