import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { db } from "@db";
import {
  vendors,
  vendorAssignedRequirements,
  vendorRuleDefinitions,
  vendorRulesetVersions,
} from "@db/schema";
import { eq, and, desc, sql, inArray, like, or } from "drizzle-orm";
import { VendorRuleEngineService } from "@/lib/services/VendorRuleEngineService";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") || "50", 10)));
    const offset = (page - 1) * limit;

    const search = searchParams.get("search") || "";
    const vendorType = searchParams.get("vendorType") || ""; // 'company' | 'freelancer'
    const complianceStatus = searchParams.get("complianceStatus") || "";

    // 1. Fetch active published ruleset and active rule definitions for matrix column headers
    const activeRules = await VendorRuleEngineService.getRuleDefinitions();

    // 2. Build where conditions for vendors
    const conditions: any[] = [eq(vendors.status, "active")];

    if (search) {
      conditions.push(
        or(
          like(vendors.companyName, `%${search}%`),
          like(vendors.contactPerson, `%${search}%`),
          like(vendors.email, `%${search}%`)
        )
      );
    }

    if (vendorType) {
      conditions.push(eq(vendors.vendorType, vendorType));
    }

    if (complianceStatus) {
      conditions.push(eq(vendors.complianceStatus, complianceStatus));
    }

    // 3. Count total matching vendors
    const totalCountRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(vendors)
      .where(and(...conditions));

    const totalVendors = Number(totalCountRes[0]?.count || 0);

    // 4. Phase 1: Fetch paginated vendors
    const paginatedVendors = await db
      .select()
      .from(vendors)
      .where(and(...conditions))
      .orderBy(desc(vendors.createdAt))
      .limit(limit)
      .offset(offset);

    const vendorIds = paginatedVendors.map((v) => v.id);

    // 5. Phase 2: Batch-load assigned requirements for these paginated vendor IDs
    let assignedMap = new Map<number, Record<string, any>>();

    if (vendorIds.length > 0) {
      const assignedReqs = await db
        .select()
        .from(vendorAssignedRequirements)
        .where(inArray(vendorAssignedRequirements.vendorId, vendorIds));

      for (const req of assignedReqs) {
        if (!assignedMap.has(req.vendorId)) {
          assignedMap.set(req.vendorId, {});
        }
        assignedMap.get(req.vendorId)![req.ruleKey] = {
          id: req.id,
          ruleKey: req.ruleKey,
          name: req.name,
          submissionStatus: req.submissionStatus,
          validityStatus: req.validityStatus,
          deadlineStatus: req.deadlineStatus,
          isMandatory: req.isMandatory,
          affectsScore: req.affectsScore,
          resolvedDueDate: req.resolvedDueDate,
        };
      }
    }

    const rows = paginatedVendors.map((v) => ({
      vendor: {
        id: v.id,
        companyName: v.companyName,
        contactPerson: v.contactPerson,
        email: v.email,
        contactNumber: v.contactNumber,
        vendorType: v.vendorType,
        engagementType: v.engagementType,
        complianceStatus: v.complianceStatus,
        complianceScore: v.complianceScore,
        complianceDeadline: v.complianceDeadline,
        bankingVerificationStatus: v.bankingVerificationStatus,
      },
      requirements: assignedMap.get(v.id) || {},
    }));

    return NextResponse.json({
      success: true,
      pagination: {
        page,
        limit,
        totalVendors,
        totalPages: Math.ceil(totalVendors / limit),
      },
      columns: activeRules.map((r) => ({
        id: r.id,
        ruleKey: r.ruleKey,
        name: r.name,
        section: r.section,
        companyApplicable: r.companyApplicable,
        freelancerApplicable: r.freelancerApplicable,
        companyMandatory: r.companyMandatory,
        freelancerMandatory: r.freelancerMandatory,
        isLocked: r.isLocked,
      })),
      rows,
    });
  } catch (error: any) {
    console.error("Failed to fetch compliance matrix:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch matrix data" },
      { status: 500 }
    );
  }
}
