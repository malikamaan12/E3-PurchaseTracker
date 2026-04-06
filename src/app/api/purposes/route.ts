import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { purposeCategories } from "@db/schema";
import { eq, and } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";

export const dynamic = 'force-dynamic';

/**
 * GET /api/purposes
 * List ONLY active purpose categories for the request form.
 * Access: Authenticated users.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const activeCategories = await db
      .select({
        id: purposeCategories.id,
        name: purposeCategories.name,
        description: purposeCategories.description,
      })
      .from(purposeCategories)
      .where(eq(purposeCategories.status, 'active'))
      .orderBy(purposeCategories.name);

    return NextResponse.json(activeCategories);
  } catch (error: any) {
    console.error("[Public API] Purpose Categories GET Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
