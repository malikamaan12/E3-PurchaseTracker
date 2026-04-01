import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { db } from "@db";
import { 
  users, 
  accountRequests, 
  subPurposes, 
  purchaseRequests,
  auditLogs,
  insertSubPurposeSchema
} from "@db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { AppError, ValidationError } from "../utils/errors";
import { debug } from "../utils/debug";
import bcrypt from "bcryptjs";

const router = Router();

// Middleware to ensure admin access
const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return next(new AppError("Not authenticated", 401));
  }
  if (req.user?.role !== "admin") {
    return next(new AppError("Admin access required", 403));
  }
  next();
};

router.use(isAdmin);

// --- Sub-purposes Management ---

// List all sub-purposes
router.get("/sub-purposes", async (req, res, next) => {
  try {
    const allSubPurposes = await db
      .select()
      .from(subPurposes)
      .orderBy(desc(subPurposes.created_at));

    debug(req, `Found ${allSubPurposes.length} sub-purposes`);
    res.json(allSubPurposes);
  } catch (error) {
    next(error);
  }
});

// Create sub-purpose
router.post("/sub-purposes", async (req, res, next) => {
  try {
    debug(req, "Creating new sub-purpose:", req.body);

    const validPurposeTypes = ["E3 EVENT", "PROJECT", "MALL", "BUSINESS GROWTH"];
    const purposeType = req.body.purposeType || req.body.purpose_type;

    if (!purposeType || !validPurposeTypes.includes(purposeType)) {
      throw new ValidationError("Invalid purpose type", {
        allowed: validPurposeTypes,
        received: purposeType,
      });
    }

    const requestData = {
      name: req.body.name,
      purpose_type: purposeType,
      is_frozen: req.body.isFrozen || req.body.is_frozen || false,
      valid_from: req.body.valid_from ? new Date(req.body.valid_from) : null,
      valid_to: req.body.valid_to ? new Date(req.body.valid_to) : null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const [newSubPurpose] = await db
      .insert(subPurposes)
      .values(requestData)
      .returning();

    res.json(newSubPurpose);
  } catch (error) {
    next(error);
  }
});

// Update sub-purpose
router.put("/sub-purposes/:id", async (req, res, next) => {
  try {
    const subPurposeId = parseInt(req.params.id);
    if (isNaN(subPurposeId)) {
      throw new ValidationError("Invalid ID", { id: "Must be a number" });
    }

    const validationResult = insertSubPurposeSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new ValidationError("Invalid input", validationResult.error.format());
    }

    const [existing] = await db
      .select()
      .from(subPurposes)
      .where(eq(subPurposes.id, subPurposeId))
      .limit(1);

    if (!existing) throw new AppError("Sub-purpose not found", 404);

    const [updated] = await db
      .update(subPurposes)
      .set({
        ...validationResult.data,
        updated_at: new Date(),
      })
      .where(eq(subPurposes.id, subPurposeId))
      .returning();

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// Delete sub-purpose
router.delete("/sub-purposes/:id", async (req, res, next) => {
  try {
    const subPurposeId = parseInt(req.params.id);
    if (isNaN(subPurposeId)) throw new AppError("Invalid ID", 400);

    // Check for references
    const [ref] = await db
      .select()
      .from(purchaseRequests)
      .where(eq(purchaseRequests.subPurposeId, subPurposeId))
      .limit(1);

    if (ref) {
      throw new AppError("Cannot delete: referenced by purchase requests", 400);
    }

    await db.delete(subPurposes).where(eq(subPurposes.id, subPurposeId));
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

// --- Account Requests Management ---

// List all account requests
router.get("/account-requests", async (req, res, next) => {
  try {
    const { status, department, role } = req.query;
    const whereConditions = [];

    if (status) whereConditions.push(eq(accountRequests.status, status as string));
    if (department) whereConditions.push(eq(accountRequests.department, department as string));
    if (role) whereConditions.push(eq(accountRequests.role, role as string));

    const results = await db
      .select()
      .from(accountRequests)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(accountRequests.createdAt));

    res.json(results);
  } catch (error) {
    next(error);
  }
});

// Approve account request
router.post("/account-requests/:id/approve", async (req, res, next) => {
  try {
    const requestId = parseInt(req.params.id);
    const [request] = await db
      .select()
      .from(accountRequests)
      .where(eq(accountRequests.id, requestId))
      .limit(1);

    if (!request) throw new AppError("Request not found", 404);
    if (request.status !== "pending") throw new AppError("Request not pending", 400);

    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.username, request.username))
      .limit(1);

    if (existingUser) throw new AppError("Username already exists", 400);

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        username: request.username,
        password: request.password,
        email: request.email,
        contact_number: request.contact_number,
        department: request.department,
        role: request.role,
        isActive: true,
      })
      .returning();

    // Update status
    await db
      .update(accountRequests)
      .set({ status: "approved" })
      .where(eq(accountRequests.id, requestId));

    res.json({ message: "Approved", user: newUser });
  } catch (error) {
    next(error);
  }
});

// Reject account request
router.post("/account-requests/:id/reject", async (req, res, next) => {
  try {
    const requestId = parseInt(req.params.id);
    const [updated] = await db
      .update(accountRequests)
      .set({ status: "rejected" })
      .where(eq(accountRequests.id, requestId))
      .returning();

    if (!updated) throw new AppError("Request not found", 404);
    res.json({ message: "Rejected" });
  } catch (error) {
    next(error);
  }
});

// --- User Management ---

// List all users
router.get("/users", async (req, res, next) => {
  try {
    const allUsers = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        department: users.department,
        role: users.role,
        contact_number: users.contact_number,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));

    res.json(allUsers);
  } catch (error) {
    next(error);
  }
});

// Update password
router.post("/users/:id/update-password", async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);
    const { password } = req.body;

    if (!password || password.length < 6) {
      throw new ValidationError("Password too short");
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw new AppError("User not found", 404);

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.update(users).set({ password: hashedPassword, updatedAt: new Date() }).where(eq(users.id, userId));

    res.json({ message: "Password updated" });
  } catch (error) {
    next(error);
  }
});

// Update role
router.post("/users/:id/update-role", async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);
    const { role } = req.body;

    if (!["user", "approver", "admin"].includes(role)) {
      throw new ValidationError("Invalid role");
    }

    const [updated] = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();

    if (!updated) throw new AppError("User not found", 404);
    res.json({ message: "Role updated", user: updated });
  } catch (error) {
    next(error);
  }
});

// Toggle activation
router.post("/users/:id/toggle-activation", async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);
    const { isActive } = req.body;

    const [updated] = await db
      .update(users)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();

    if (!updated) throw new AppError("User not found", 404);
    res.json({ message: "Status updated", user: updated });
  } catch (error) {
    next(error);
  }
});

// Check deletion eligibility
router.get("/users/:id/check-deletion", async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);
    const [pr] = await db
      .select()
      .from(purchaseRequests)
      .where(eq(purchaseRequests.requesterId, userId))
      .limit(1);

    res.json({ canDelete: !pr, reason: pr ? "User has purchase requests" : null });
  } catch (error) {
    next(error);
  }
});

// Delete user
router.delete("/users/:id", async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);
    const [pr] = await db
      .select()
      .from(purchaseRequests)
      .where(eq(purchaseRequests.requesterId, userId))
      .limit(1);

    if (pr) throw new AppError("Cannot delete user with requests", 400);

    const [deleted] = await db.delete(users).where(eq(users.id, userId)).returning();
    if (!deleted) throw new AppError("User not found", 404);
    res.json({ message: "User deleted" });
  } catch (error) {
    next(error);
  }
});

// --- Audit Logs ---
router.get("/audit-logs", async (req, res, next) => {
  try {
    const logs = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        resourceId: auditLogs.resourceId,
        resourceType: auditLogs.resourceType,
        details: auditLogs.details,
        ipAddress: auditLogs.ipAddress,
        timestamp: auditLogs.timestamp,
        user: {
          username: users.username,
        }
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .orderBy(desc(auditLogs.timestamp));

    res.json(logs);
  } catch (error) {
    next(error);
  }
});

export default router;
