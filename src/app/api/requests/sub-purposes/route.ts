import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { subPurposes, purposeCategories, subPurposeBudgets, departments } from "@db/schema";
import { eq, and, desc, sql, lte, gte, or } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";

export const dynamic = 'force-dynamic';

// GET /api/requests/sub-purposes
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const purposeType = searchParams.get("purposeType");
    const purposeCategoryId = searchParams.get("purposeCategoryId");
    const now = new Date();
    
    // 1. Resolve user's department ID
    const [userDept] = await db
      .select({ id: departments.id })
      .from(departments)
      .where(eq(departments.name, user.department))
      .limit(1);

    if (!userDept) {
      return NextResponse.json([]); // No department, no projects
    }

    // 2. Core filtering: Project must be 'active'
    // Note: Date validity is handled separately to allow "Visible but Disabled" logic in UI
    const conditions = [
      eq(subPurposes.status, 'active'),
      eq(purposeCategories.status, 'active'), // Parent category must also be active
    ];

    if (purposeType) {
      conditions.push(eq(subPurposes.purposeType, purposeType));
    }

    if (purposeCategoryId) {
      conditions.push(eq(subPurposes.purposeCategoryId, parseInt(purposeCategoryId)));
    }

    // 3. Fetch sub-purposes WITH departmental budget allocations
    // Using LEFT JOIN so projects without a specific departmental budget allocation still appear.
    // If no allocation exists, allocatedAmount defaults to 0.
    const activeSubPurposes = await db
      .select({
        id: subPurposes.id,
        name: subPurposes.name,
        purposeType: subPurposes.purposeType,
        totalBudget: subPurposes.totalBudget,
        validFrom: subPurposes.validFrom,
        validTo: subPurposes.validTo,
        allocatedAmount: sql`COALESCE(${subPurposeBudgets.allocatedAmount}, 0)`.mapWith(Number),
      })
      .from(subPurposes)
      .innerJoin(purposeCategories, eq(subPurposes.purposeCategoryId, purposeCategories.id))
      .leftJoin(subPurposeBudgets, and(
        eq(subPurposes.id, subPurposeBudgets.subPurposeId),
        eq(subPurposeBudgets.departmentId, userDept.id)
      ))
      .where(and(...conditions))
      .orderBy(desc(subPurposes.createdAt));

    return NextResponse.json(activeSubPurposes);
  } catch (error: any) {
    console.error("[Native API] Sub-purposes Filtering Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
