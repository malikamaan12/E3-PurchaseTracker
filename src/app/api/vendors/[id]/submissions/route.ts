import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { VendorSubmissionService } from "@/lib/services/VendorSubmissionService";
import { db } from "@db";
import { vendorAssignedRequirements, vendorRequirementSubmissions, vendors } from "@db/schema";
import { eq, desc } from "drizzle-orm";

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

    const assigned = await db
      .select()
      .from(vendorAssignedRequirements)
      .where(eq(vendorAssignedRequirements.vendorId, vendorId))
      .orderBy(vendorAssignedRequirements.displayOrder);

    const submissions = await db
      .select()
      .from(vendorRequirementSubmissions)
      .where(eq(vendorRequirementSubmissions.vendorId, vendorId))
      .orderBy(desc(vendorRequirementSubmissions.submittedAt));

    const submissionsMap = new Map<number, any[]>();
    for (const sub of submissions) {
      if (!submissionsMap.has(sub.assignedRequirementId)) {
        submissionsMap.set(sub.assignedRequirementId, []);
      }
      submissionsMap.get(sub.assignedRequirementId)!.push(sub);
    }

    const requirementsWithSubmissions = assigned.map((req) => ({
      ...req,
      submissions: submissionsMap.get(req.id) || [],
      latestSubmission: (submissionsMap.get(req.id) || [])[0] || null,
    }));

    return NextResponse.json({
      success: true,
      requirements: requirementsWithSubmissions,
    });
  } catch (error: any) {
    console.error("Failed to fetch vendor submissions:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch submissions" },
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
    const { assignedRequirementId, fieldValue, documentIds, expiryDate, submissionNotes } = body;

    if (!assignedRequirementId) {
      return NextResponse.json(
        { success: false, message: "assignedRequirementId is required." },
        { status: 400 }
      );
    }

    const result = await VendorSubmissionService.submitResponse(
      assignedRequirementId,
      { fieldValue, documentIds, expiryDate, submissionNotes },
      { type: "user", id: user.id }
    );

    return NextResponse.json({
      success: true,
      submission: result.submission,
      assignedRequirement: result.assignedRequirement,
    });
  } catch (error: any) {
    console.error("Failed to submit requirement response:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to submit response" },
      { status: 500 }
    );
  }
}
