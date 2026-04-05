import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { departments, users, accountRequests, insertDepartmentSchema } from "@db/schema";
import { eq, asc, count } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";

/**
 * GET /api/departments
 * List all departments (accessible to any authenticated user)
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const list = await db.select().from(departments).orderBy(asc(departments.name));
    return NextResponse.json(list);
  } catch (error) {
    console.error("[Departments API] GET Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * POST /api/departments
 * Create department (Admin only)
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
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
    console.error("[Departments API] POST Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
