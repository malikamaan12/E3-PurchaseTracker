import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { departments } from "@db/schema";
import { asc } from "drizzle-orm";

export const dynamic = 'force-dynamic';

/**
 * GET /api/departments
 * Public read-only access to department list for sign-up forms.
 * Returns only id and name.
 */
export async function GET(req: NextRequest) {
  try {
    const list = await db
      .select({ 
        id: departments.id, 
        name: departments.name 
      })
      .from(departments)
      .orderBy(asc(departments.name));
      
    return NextResponse.json(list);
  } catch (error) {
    console.error("[Public Departments API] GET Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
