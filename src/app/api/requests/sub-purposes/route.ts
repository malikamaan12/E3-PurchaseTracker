import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { subPurposes, purposeCategories, subPurposeBudgets, departments } from "@db/schema";
import { eq, and, desc, sql, lte, gte, or, ilike } from "drizzle-orm";
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
    const isAdmin = user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'super_admin';
    const isApprover = user?.role?.toLowerCase() === 'approver' || user?.isApprover === true;
    
    console.log(`[Sub-Purposes API] User: ${user.username}, Role: ${user.role}, isAdmin: ${isAdmin}`);

    // 1. Resolve user's department ID
    const [userDept] = await db
      .select({ id: departments.id })
      .from(departments)
      .where(ilike(departments.name, user.department))
      .limit(1);

    console.log(`[Sub-Purposes API] Resolved Dept for "${user.department}":`, userDept?.id || 'none');

    // 2. Build conditions
    const conditions: any[] = [];

    // Only apply active filters if NOT admin
    if (!isAdmin) {
      conditions.push(eq(subPurposes.status, 'active'));
      // Only check category status if not admin
      conditions.push(or(
        eq(purposeCategories.status, 'active'),
        sql`${purposeCategories.status} IS NULL`
      ));
    }

    if (purposeType && purposeType !== "all") {
      conditions.push(eq(subPurposes.purposeType, purposeType));
    }

    if (purposeCategoryId && purposeCategoryId !== "all") {
      conditions.push(eq(subPurposes.purposeCategoryId, parseInt(purposeCategoryId)));
    }

    // 3. Fetch sub-purposes
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
      .leftJoin(purposeCategories, eq(subPurposes.purposeCategoryId, purposeCategories.id))
      .leftJoin(subPurposeBudgets, and(
        eq(subPurposes.id, subPurposeBudgets.subPurposeId),
        userDept ? eq(subPurposeBudgets.departmentId, userDept.id) : sql`1=0`
      ))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(subPurposes.createdAt));

    console.log(`[Sub-Purposes API] Returning ${activeSubPurposes.length} projects`);
    return NextResponse.json(activeSubPurposes);
  } catch (error: any) {
    console.error("[Native API] Sub-purposes Filtering Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
