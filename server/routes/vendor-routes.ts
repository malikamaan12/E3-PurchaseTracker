import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { db } from "@db";
import { vendors, purchaseRequests, insertVendorSchema } from "@db/schema";
import { eq, and, desc, ne, sql } from "drizzle-orm";
import { debug } from "../utils/debug";
import { AppError, ValidationError, DatabaseError } from "../utils/errors";

const router = Router();

// GET all vendors
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.isAuthenticated()) {
      throw new AppError("Not authenticated", 401);
    }

    debug(req, "Fetching vendors");

    const allVendors = await db
      .select()
      .from(vendors)
      .orderBy(desc(vendors.createdAt));

    debug(req, `Found ${allVendors.length} vendors`);
    res.json(allVendors);
  } catch (error) {
    debug(req, "Error fetching vendors:", error);
    next(error);
  }
});

// POST new vendor
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.isAuthenticated()) {
      throw new AppError("Not authenticated", 401);
    }

    debug(req, "Creating new vendor - Raw request body:", req.body);

    // Validate vendor data
    const validationResult = insertVendorSchema.safeParse(req.body);

    if (!validationResult.success) {
      debug(req, "Validation failed:", validationResult.error);
      return res.status(400).json({
        message: "Validation failed",
        errors: validationResult.error.format(),
      });
    }

    // Check if vendor with same name already exists
    const [existingVendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.companyName, validationResult.data.companyName))
      .limit(1);

    if (existingVendor) {
      return res.status(400).json({
        message: "Vendor with this company name already exists",
      });
    }

    // Create new vendor - omit id-related fields that should be auto-generated or not present
    const { id: _id, createdAt: _ca, updatedAt: _ua, ...vendorData } = validationResult.data as any;

    const [newVendor] = await db
      .insert(vendors)
      .values({
        ...vendorData,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    debug(req, "Successfully created vendor:", newVendor);
    res.status(201).json(newVendor);
  } catch (error) {
    debug(req, "Error creating vendor:", error);
    next(error);
  }
});

// GET vendor by ID
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.isAuthenticated()) {
      throw new AppError("Not authenticated", 401);
    }

    const vendorId = parseInt(req.params.id);
    debug(req, `Fetching vendor details for ID: ${vendorId}`);

    if (isNaN(vendorId)) {
      throw new ValidationError("Invalid vendor ID", {
        id: "Must be a number",
      });
    }

    const [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.id, vendorId))
      .limit(1);

    if (!vendor) {
      throw new AppError("Vendor not found", 404);
    }

    debug(req, "Found vendor:", vendor);
    res.json(vendor);
  } catch (error) {
    debug(req, "Error fetching vendor:", error);
    next(error);
  }
});

// PATCH update vendor
router.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.isAuthenticated()) {
      throw new AppError("Not authenticated", 401);
    }

    const vendorId = parseInt(req.params.id);
    debug(req, `Updating vendor with ID: ${vendorId}`, req.body);

    if (isNaN(vendorId)) {
      throw new ValidationError("Invalid vendor ID", {
        id: "Must be a number",
      });
    }

    // Check if vendor exists
    const [existingVendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.id, vendorId))
      .limit(1);

    if (!existingVendor) {
      throw new AppError("Vendor not found", 404);
    }

    // Validate update data
    const validationResult = insertVendorSchema.partial().safeParse(req.body);

    if (!validationResult.success) {
      debug(req, "Vendor update validation failed:", validationResult.error);
      throw new ValidationError("Invalid vendor data", validationResult.error.format());
    }

    // Check for name conflict
    if (req.body.companyName && req.body.companyName !== existingVendor.companyName) {
      const [nameConflict] = await db
        .select()
        .from(vendors)
        .where(and(eq(vendors.companyName, req.body.companyName), ne(vendors.id, vendorId)))
        .limit(1);

      if (nameConflict) {
        throw new ValidationError("Company name already exists", {
          companyName: ["This company name is already registered for another vendor"],
        });
      }
    }

    const processedData = { ...validationResult.data };
    const updateFields: any = {};
    
    Object.keys(processedData).forEach((key) => {
      if (key !== "id" && (processedData as any)[key] !== undefined) {
        if (key === "rating") {
          updateFields[key] = typeof (processedData as any)[key] === "string" 
            ? Number((processedData as any)[key]) || 0 
            : (processedData as any)[key] || 0;
        } else {
          // Nullify empty strings for specific fields
          const val = (processedData as any)[key];
          if ((key === "taxNumber" || key === "registrationNumber" || key === "remarks") && val === "") {
            updateFields[key] = null;
          } else {
            updateFields[key] = val;
          }
        }
      }
    });

    updateFields.updatedAt = new Date();

    const [updatedVendor] = await db
      .update(vendors)
      .set(updateFields)
      .where(eq(vendors.id, vendorId))
      .returning();

    if (!updatedVendor) {
      throw new Error("Database update failed (no vendor returned)");
    }

    debug(req, "Successfully updated vendor:", updatedVendor);
    res.json(updatedVendor);
  } catch (error) {
    debug(req, "Error updating vendor:", error);
    next(error);
  }
});

// PATCH update vendor status
router.patch("/:id/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.isAuthenticated()) {
      throw new AppError("Not authenticated", 401);
    }

    if (req.user?.role !== "admin") {
      throw new AppError("Admin access required for vendor status changes", 403);
    }

    const vendorId = parseInt(req.params.id);
    const { status } = req.body;

    if (isNaN(vendorId)) {
      throw new ValidationError("Invalid vendor ID", { id: "Must be a number" });
    }

    if (!status || !["active", "blocked", "frozen"].includes(status)) {
      throw new ValidationError("Invalid status value", {
        status: ["Status must be one of: active, blocked, frozen"],
      });
    }

    const [existingVendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.id, vendorId))
      .limit(1);

    if (!existingVendor) {
      throw new AppError("Vendor not found", 404);
    }

    const [updatedVendor] = await db
      .update(vendors)
      .set({ status, updatedAt: new Date() })
      .where(eq(vendors.id, vendorId))
      .returning();

    debug(req, "Successfully updated vendor status:", updatedVendor);
    res.json(updatedVendor);
  } catch (error) {
    debug(req, "Error updating vendor status:", error);
    next(error);
  }
});

// DELETE vendor
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.isAuthenticated()) {
      throw new AppError("Not authenticated", 401);
    }

    if (req.user?.role !== "admin") {
      throw new AppError("Admin access required for deleting vendors", 403);
    }

    const vendorId = parseInt(req.params.id);
    if (isNaN(vendorId)) {
      throw new ValidationError("Invalid vendor ID", { id: "Must be a number" });
    }

    const [existingVendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.id, vendorId))
      .limit(1);

    if (!existingVendor) {
      throw new AppError("Vendor not found", 404);
    }

    const countResult = await db.execute(
      sql`SELECT COUNT(*) AS count FROM purchase_requests WHERE vendor_id = ${vendorId}`
    );
    const count = parseInt((countResult.rows[0] as any).count);

    if (count > 0) {
      throw new AppError(
        `Cannot delete vendor because it is used in ${count} purchase requests. Consider blocking or freezing the vendor instead.`,
        400
      );
    }

    await db.delete(vendors).where(eq(vendors.id, vendorId));
    debug(req, "Successfully deleted vendor");
    res.json({ success: true, message: "Vendor deleted successfully" });
  } catch (error) {
    debug(req, "Error deleting vendor:", error);
    next(error);
  }
});

export default router;
