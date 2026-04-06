import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { purposeCategories, subPurposes } from "@db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/catalog
 * List all purpose categories with their nested sub-purposes.
 * Access: Admin only.
 */
export async function GET(req: NextRequest) {
  try {
    const admin = await getAuthenticatedUser(req);
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: "Access denied. Admin only." }, { status: 403 });
    }

    // Fetch all categories using raw SQL mapping
    const categories: any = await db.execute(sql`
      SELECT 
        id, 
        name, 
        description, 
        status, 
        created_at as "createdAt", 
        updated_at as "updatedAt"
      FROM purpose_categories
      ORDER BY name ASC
    `);
    const categoryRows = (Array.isArray(categories) ? categories : categories.rows || []);

    // Fetch all sub-purposes using raw SQL mapping
    const subPurposes: any = await db.execute(sql`
      SELECT 
        id, 
        purpose_category_id as "purposeCategoryId", 
        name, 
        purpose_type as "purposeType", 
        status, 
        total_budget as "totalBudget", 
        is_frozen as "isFrozen", 
        valid_from as "validFrom", 
        valid_to as "validTo", 
        created_at as "createdAt", 
        updated_at as "updatedAt"
      FROM sub_purposes
      ORDER BY name ASC
    `);
    const subPurposeRows = (Array.isArray(subPurposes) ? subPurposes : subPurposes.rows || []);

    // Nest sub-purposes into categories
    const catalog = categoryRows.map((cat: any) => ({
      ...cat,
      subPurposes: subPurposeRows.filter((sp: any) => sp.purposeCategoryId === cat.id)
    }));

    // Add a "Uncategorized" section if there are sub-purposes without a category
    const uncategorized = subPurposeRows.filter((sp: any) => !sp.purposeCategoryId);
    if (uncategorized.length > 0) {
      catalog.push({
        id: 0,
        name: "Uncategorized Projects",
        description: "Projects not yet assigned to a strategic category",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
        subPurposes: uncategorized
      } as any);
    }

    return NextResponse.json(catalog);
  } catch (error: any) {
    console.error("[Admin API] Catalog GET Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
