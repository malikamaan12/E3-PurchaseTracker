import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { departments, insertDepartmentSchema } from "@db/schema";
import { asc, desc } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/departments
 * List ALL departments for management.
 * Access: Admin only.
 */
export async function GET(req: NextRequest) {
  try {
    const admin = await getAuthenticatedUser(req);
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: "Access denied. Admin only." }, { status: 403 });
    }

    const list = await db.select().from(departments).orderBy(asc(departments.name));
    return NextResponse.json(list);
  } catch (error) {
    console.error("[Admin Departments API] GET Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/departments
 * Create a new department.
 * Access: Admin only.
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await getAuthenticatedUser(req);
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: "Access denied. Admin only." }, { status: 403 });
    }

    const body = await req.json();
    const result = insertDepartmentSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
    }

    const [newDept] = await db.insert(departments).values(result.data).returning();
    return NextResponse.json(newDept, { status: 201 });
  } catch (error: any) {
    if (error.code === '23505') { // Unique violation
      return NextResponse.json({ error: "A department with this name already exists" }, { status: 400 });
    }
    console.error("[Admin Departments API] POST Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
