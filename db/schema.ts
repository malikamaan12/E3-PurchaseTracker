import { pgTable, text, serial, integer, boolean, timestamp, json, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
  email: text("email").notNull(),
  contactNumber: text("contact_number").notNull(),
  department: text("department").notNull(),
  role: text("role").notNull().default("user"),
});

export const vendors = pgTable("vendors", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull(),
  registrationNumber: text("registration_number").notNull(),
  email: text("email").notNull(),
  contactNumber: text("contact_number").notNull(),
  accountNumber: text("account_number").notNull(),
  ibanNumber: text("iban_number").notNull(),
  contactPerson: text("contact_person").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const subPurposes = pgTable("sub_purposes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  purposeType: text("purpose_type").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const purchaseRequests = pgTable("purchase_requests", {
  id: serial("id").primaryKey(),
  requestNumber: text("request_number").unique().notNull(),
  requesterId: integer("requester_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  items: json("items").$type<Array<{
    name: string;
    quantity: number;
    estimatedCost: number;
  }>>().notNull(),
  vendorId: integer("vendor_id").notNull().references(() => vendors.id),
  vendor: text("vendor").notNull(),
  purpose: text("purpose").notNull(),
  purposeType: text("purpose_type").notNull(),
  subPurposeId: integer("sub_purpose_id").references(() => subPurposes.id),
  priority: text("priority").notNull().default("medium"),
  currency: text("currency").notNull().default("QAR"),
  totalEstimatedCost: decimal("total_estimated_cost", { precision: 10, scale: 2 }).notNull(),
  freightAmount: decimal("freight_amount", { precision: 10, scale: 2 }).notNull().default('0'),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const approvals = pgTable("approvals", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull().references(() => purchaseRequests.id),
  approverId: integer("approver_id").notNull().references(() => users.id),
  department: text("department").notNull(),
  status: text("status").notNull().default("pending"),
  comments: text("comments"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const purchaseRequestRelations = relations(purchaseRequests, ({ one, many }) => ({
  requester: one(users, {
    fields: [purchaseRequests.requesterId],
    references: [users.id],
  }),
  vendor: one(vendors, {
    fields: [purchaseRequests.vendorId],
    references: [vendors.id],
  }),
  approvals: many(approvals),
  subPurpose: one(subPurposes, {
    fields: [purchaseRequests.subPurposeId],
    references: [subPurposes.id],
  }),
}));

export const approvalRelations = relations(approvals, ({ one }) => ({
  request: one(purchaseRequests, {
    fields: [approvals.requestId],
    references: [purchaseRequests.id],
  }),
  approver: one(users, {
    fields: [approvals.approverId],
    references: [users.id],
  }),
}));

export const insertUserSchema = createInsertSchema(users, {
  username: z.string().min(1, "Username is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  email: z.string().email("Invalid email address"),
  contactNumber: z.string().min(1, "Contact number is required"),
  department: z.enum(["Management", "Business", "Operations", "Support", "CEO Office", "Finance", "Director"]),
  role: z.enum(["user", "admin", "approver"]).optional(),
});
export const selectUserSchema = createSelectSchema(users);
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export const insertVendorSchema = createInsertSchema(vendors);
export const selectVendorSchema = createSelectSchema(vendors);
export type Vendor = typeof vendors.$inferSelect;
export type NewVendor = typeof vendors.$inferInsert;

export const insertPurchaseRequestSchema = createInsertSchema(purchaseRequests, {
  purposeType: z.enum(["event", "project", "mall", "business_growth"]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  currency: z.enum(["QAR", "USD", "CNY"]),
  totalEstimatedCost: z.string().transform((val) => Number(val)),
  freightAmount: z.string().transform((val) => Number(val)),
  items: z.array(z.object({
    name: z.string().min(1, "Item name is required"),
    quantity: z.number().int().positive("Quantity must be a positive number"),
    estimatedCost: z.number().min(0, "Cost must be non-negative")
  })).min(1, "At least one item is required"),
  vendorId: z.number({
    required_error: "Vendor is required",
    invalid_type_error: "Vendor must be selected",
  }).positive("Please select a valid vendor"),
  vendor: z.string().min(1, "Vendor name is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  purpose: z.string().min(1, "Purpose is required"),
  status: z.enum(["draft", "pending", "approved", "rejected"]).optional(),
  requestNumber: z.string().optional(),
  requesterId: z.number().optional(),
});

export const selectPurchaseRequestSchema = createSelectSchema(purchaseRequests, {
  totalEstimatedCost: z.coerce.number(),
  freightAmount: z.coerce.number(),
  items: z.array(z.object({
    name: z.string(),
    quantity: z.coerce.number(),
    estimatedCost: z.coerce.number()
  }))
});

export type PurchaseRequest = z.infer<typeof selectPurchaseRequestSchema> & {
  approvals: Array<z.infer<typeof selectApprovalSchema> & { approver: User }>;
  subPurpose: z.infer<typeof selectSubPurposeSchema> | null;
  vendor: z.infer<typeof selectVendorSchema> | null;
  requester: User;
};

export type NewPurchaseRequest = typeof purchaseRequests.$inferInsert;

export const insertApprovalSchema = createInsertSchema(approvals);
export const selectApprovalSchema = createSelectSchema(approvals);
export type Approval = typeof approvals.$inferSelect;
export type NewApproval = typeof approvals.$inferInsert;

export const insertSubPurposeSchema = createInsertSchema(subPurposes);
export const selectSubPurposeSchema = createSelectSchema(subPurposes);
export type SubPurpose = typeof subPurposes.$inferSelect;
export type NewSubPurpose = typeof subPurposes.$inferInsert;