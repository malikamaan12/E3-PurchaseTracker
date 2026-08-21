import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { VendorSubmissionService } from "@/lib/services/VendorSubmissionService";
import { db } from "@db";
import { auditLogs } from "@db/schema";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string; submissionId: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "admin" && user.role !== "super_admin" && user.department?.toLowerCase() !== "finance") {
      return NextResponse.json(
        { success: false, message: "Only Finance, Admin, or Super Admin can verify requirements." },
        { status: 403 }
      );
    }

    const { id, submissionId } = await context.params;
    const subId = parseInt(submissionId, 10);
    const vendorId = parseInt(id, 10);

    if (isNaN(subId) || isNaN(vendorId)) {
      return NextResponse.json({ success: false, message: "Invalid IDs" }, { status: 400 });
    }

    const body = await req.json();
    const { decision, notes } = body; // decision: 'verify' | 'reject'

    if (decision !== "verify" && decision !== "reject") {
      return NextResponse.json(
        { success: false, message: "decision must be 'verify' or 'reject'." },
        { status: 400 }
      );
    }

    const result = await VendorSubmissionService.verifySubmission(subId, decision, user.id, notes);

    // Audit log
    await db.insert(auditLogs).values({
      userId: user.id,
      action: decision === "verify" ? "REQUIREMENT_VERIFIED" : "REQUIREMENT_REJECTED",
      resourceType: "vendor_requirement_submission",
      resourceId: subId,
      details: {
        vendorId,
        decision,
        notes,
        assignedRequirementId: result.assignedRequirement.id,
        ruleKey: result.assignedRequirement.ruleKey,
      },
    });

    return NextResponse.json({
      success: true,
      submission: result.submission,
      assignedRequirement: result.assignedRequirement,
    });
  } catch (error: any) {
    console.error("Failed to verify submission:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to verify submission" },
      { status: 500 }
    );
  }
}
