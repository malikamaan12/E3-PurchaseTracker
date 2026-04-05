import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { departments, users, accountRequests, insertDepartmentSchema } from "@db/schema";
import { eq, count } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";

/**
 * PATCH /api/departments/[id]
 * Update department (Admin only)
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: paramId } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const id = parseInt(paramId);
    if (isNaN(id)) return NextResponse.json({ error: "Invalid department ID" }, { status: 400 });

    const body = await req.json();
    const result = insertDepartmentSchema.partial().safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
    }

    const [updated] = await db.update(departments)
      .set({ ...result.data, updatedAt: new Date() })
      .where(eq(departments.id, id))
      .returning();

    if (!updated) return NextResponse.json({ error: "Department not found" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("[Departments API] PATCH Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * DELETE /api/departments/[id]
 * Delete department with dependency checks (Admin only)
 * Safe Deletion Shield: Blocks deletion if active users or account requests exist.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: paramId } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const id = parseInt(paramId);
    if (isNaN(id)) return NextResponse.json({ error: "Invalid department ID" }, { status: 400 });

    // 1. Get the department first
    const [dept] = await db.select().from(departments).where(eq(departments.id, id)).limit(1);
    if (!dept) return NextResponse.json({ error: "Department not found" }, { status: 404 });

    // 2. Check if any active users are in this department
    const [userCount] = await db.select({ count: count() }).from(users).where(eq(users.department, dept.name));
    if (Number(userCount.count) > 0) {
      return NextResponse.json({ 
        error: `Cannot delete department "${dept.name}" because ${userCount.count} users are currently assigned to it.` 
      }, { status: 400 });
    }

    // 3. Check for pending account requests
    const [requestCount] = await db.select({ count: count() }).from(accountRequests).where(eq(accountRequests.department, dept.name));
    if (Number(requestCount.count) > 0) {
      return NextResponse.json({ 
        error: `Cannot delete department "${dept.name}" because there are ${requestCount.count} pending account requests for it.` 
      }, { status: 400 });
    }

    await db.delete(departments).where(eq(departments.id, id));
    return new Response(null, { status: 204 });
  } catch (error: any) {
    console.error("[Departments API] DELETE Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
