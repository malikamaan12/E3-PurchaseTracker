import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { VendorBankingStagingService } from "@/lib/services/VendorBankingStagingService";
import { db } from "@db";
import { vendors, vendorBankingSubmissions, auditLogs } from "@db/schema";
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

    const [vendor] = await db.select().from(vendors).where(eq(vendors.id, vendorId)).limit(1);
    if (!vendor) {
      return NextResponse.json({ success: false, message: "Vendor not found" }, { status: 404 });
    }

    const submissions = await db
      .select()
      .from(vendorBankingSubmissions)
      .where(eq(vendorBankingSubmissions.vendorId, vendorId))
      .orderBy(desc(vendorBankingSubmissions.submittedAt));

    const isFinanceOrAdmin =
      user.role === "admin" ||
      user.role === "super_admin" ||
      user.department?.toLowerCase() === "finance";

    // Mask for non-finance users
    const canonicalBanking = {
      bankName: vendor.bankName,
      branchName: vendor.branchName,
      accountNumber: isFinanceOrAdmin
        ? vendor.accountNumber
        : VendorBankingStagingService.maskAccountNumber(vendor.accountNumber),
      ibanNumber: isFinanceOrAdmin
        ? vendor.ibanNumber
        : VendorBankingStagingService.maskIban(vendor.ibanNumber),
      bankingVerificationStatus: vendor.bankingVerificationStatus,
      payment_currency: vendor.payment_currency,
    };

    const stagedSubmissions = submissions.map((sub) => ({
      ...sub,
      accountNumber: isFinanceOrAdmin
        ? sub.accountNumber
        : VendorBankingStagingService.maskAccountNumber(sub.accountNumber),
      ibanNumber: isFinanceOrAdmin
        ? sub.ibanNumber
        : VendorBankingStagingService.maskIban(sub.ibanNumber),
    }));

    return NextResponse.json({
      success: true,
      canonicalBanking,
      stagedSubmissions,
      latestStaged: stagedSubmissions[0] || null,
    });
  } catch (error: any) {
    console.error("Failed to fetch vendor banking staging:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch banking details" },
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
    const { action, submissionId, bankName, branchName, accountNumber, ibanNumber, payment_currency, notes, isApproved } = body;

    // Action 1: Submit new banking details for staging
    if (action === "stage_submission") {
      if (!bankName || !accountNumber || !ibanNumber) {
        return NextResponse.json(
          { success: false, message: "Bank name, account number, and IBAN are required." },
          { status: 400 }
        );
      }

      const staged = await VendorBankingStagingService.stageSubmission(vendorId, {
        bankName,
        branchName: branchName || "Main Branch",
        accountNumber,
        ibanNumber,
        payment_currency: payment_currency || "QAR",
      });

      return NextResponse.json({ success: true, stagedSubmission: staged });
    }

    // Action 2: Finance Stage 1 Review
    if (action === "review_stage1") {
      if (user.role !== "admin" && user.role !== "super_admin" && user.department?.toLowerCase() !== "finance") {
        return NextResponse.json(
          { success: false, message: "Only Finance or Admins can perform Stage 1 Banking Review." },
          { status: 403 }
        );
      }

      if (!submissionId) {
        return NextResponse.json({ success: false, message: "submissionId is required." }, { status: 400 });
      }

      const reviewed = await VendorBankingStagingService.reviewStage1(
        submissionId,
        user.id,
        notes,
        isApproved !== false
      );

      return NextResponse.json({ success: true, reviewedSubmission: reviewed });
    }

    // Action 3: Super Admin Stage 2 Confirmation
    if (action === "review_stage2") {
      if (user.role !== "super_admin") {
        return NextResponse.json(
          { success: false, message: "Only Super Admins can perform Stage 2 Banking Confirmation." },
          { status: 403 }
        );
      }

      if (!submissionId) {
        return NextResponse.json({ success: false, message: "submissionId is required." }, { status: 400 });
      }

      const confirmed = await VendorBankingStagingService.reviewStage2(
        submissionId,
        user.id,
        notes,
        isApproved !== false
      );

      return NextResponse.json({ success: true, confirmedSubmission: confirmed });
    }

    return NextResponse.json({ success: false, message: "Invalid action." }, { status: 400 });
  } catch (error: any) {
    console.error("Failed to process banking staging action:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to process banking action" },
      { status: 500 }
    );
  }
}
