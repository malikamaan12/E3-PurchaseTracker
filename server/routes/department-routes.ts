import { Router } from "express";
import { db } from "@db";
import { departments, users, accountRequests } from "@db/schema";
import { eq, asc, desc, count } from "drizzle-orm";
import { requireAuth, requireRole } from "../utils/middleware";
import { AppError } from "../utils/errors";
import { insertDepartmentSchema } from "@db/schema";

const router = Router();

// GET /api/departments - List all departments (accessible to any authenticated user)
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const list = await db.select().from(departments).orderBy(asc(departments.name));
    res.json(list);
  } catch (error) {
    next(error);
  }
});

// POST /api/departments - Create department (Admin only)
router.post("/", requireRole("admin"), async (req, res, next) => {
  try {
    const result = insertDepartmentSchema.safeParse(req.body);
    if (!result.success) {
      return next(new AppError(result.error.errors[0].message, 400));
    }

    const [newDept] = await db.insert(departments).values(result.data).returning();
    res.status(201).json(newDept);
  } catch (error: any) {
    if (error.code === '23505') { // Unique violation
      return next(new AppError("A department with this name already exists", 400));
    }
    next(error);
  }
});

// PATCH /api/departments/:id - Update department (Admin only)
router.patch("/:id", requireRole("admin"), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return next(new AppError("Invalid department ID", 400));

    const result = insertDepartmentSchema.partial().safeParse(req.body);
    if (!result.success) {
      return next(new AppError(result.error.errors[0].message, 400));
    }

    const [updated] = await db.update(departments)
      .set({ ...result.data, updatedAt: new Date() })
      .where(eq(departments.id, id))
      .returning();

    if (!updated) return next(new AppError("Department not found", 404));
    res.json(updated);
  } catch (error: any) {
    next(error);
  }
});

// DELETE /api/departments/:id - Delete department (Admin only)
router.delete("/:id", requireRole("admin"), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return next(new AppError("Invalid department ID", 400));

    // 1. Get the department name first
    const [dept] = await db.select().from(departments).where(eq(departments.id, id)).limit(1);
    if (!dept) return next(new AppError("Department not found", 404));

    // 2. Check if any active users are in this department
    const [userCount] = await db.select({ count: count() }).from(users).where(eq(users.department, dept.name));
    if (Number(userCount.count) > 0) {
      return next(new AppError(`Cannot delete department "${dept.name}" because ${userCount.count} users are currently assigned to it.`, 400));
    }

    // 3. Check for pending account requests
    const [requestCount] = await db.select({ count: count() }).from(accountRequests).where(eq(accountRequests.department, dept.name));
     if (Number(requestCount.count) > 0) {
      return next(new AppError(`Cannot delete department "${dept.name}" because there are ${requestCount.count} pending account requests for it.`, 400));
    }

    await db.delete(departments).where(eq(departments.id, id));
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
