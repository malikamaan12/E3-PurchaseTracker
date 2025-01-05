import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Company Branding table definition
export const companyBranding = pgTable("company_branding", {
  id: serial("id").primaryKey(),
  company_name: text("company_name").notNull(),
  header_style: text("header_style").notNull().default("modern"),
  primary_color: text("primary_color").notNull().default("#71569E"),
  secondary_color: text("secondary_color").notNull().default("#F0F0FA"),
  accent_color: text("accent_color").notNull().default("#191160"),
  logo: text("logo"),
  logo_mime_type: text("logo_mime_type"),
  header_image_url: text("header_image_url"),
  header_image_mime_type: text("header_image_mime_type"),
  footer_image_url: text("footer_image_url"),
  footer_image_mime_type: text("footer_image_mime_type"),
  footer_text: text("footer_text"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Base schema for company branding validation
export const companyBrandingSchema = z.object({
  company_name: z.string().min(1, "Company name is required"),
  header_style: z.enum(["modern", "classic", "minimal"]).default("modern"),
  primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format").default("#71569E"),
  secondary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format").default("#F0F0FA"),
  accent_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format").default("#191160"),
  logo: z.string().nullable(),
  logo_mime_type: z.string().nullable(),
  header_image_url: z.string().nullable(),
  header_image_mime_type: z.string().nullable(),
  footer_image_url: z.string().nullable(),
  footer_image_mime_type: z.string().nullable(),
  footer_text: z.string().nullable(),
});

// Create insert and select schemas
export const insertCompanyBrandingSchema = companyBrandingSchema;
export const selectCompanyBrandingSchema = createSelectSchema(companyBranding);

// Type definitions for company branding
export type CompanyBranding = typeof companyBranding.$inferSelect;
export type InsertCompanyBranding = z.infer<typeof companyBrandingSchema>;

//users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
  email: text("email").notNull(),
  contact_number: text("contact_number").notNull(),
  department: text("department").notNull(),
  role: text("role").notNull().default("user"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const accountRequests = pgTable("account_requests", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
  email: text("email").notNull(),
  contact_number: text("contact_number").notNull(),
  department: text("department").notNull(),
  role: text("role").notNull().default("user"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  requestId: integer("request_id").references(() => purchaseRequests.id),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  link: text("link"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const errorLogs = pgTable("error_logs", {
  id: serial("id").primaryKey(),
  message: text("message").notNull(),
  code: text("code"),
  severity: text("severity").notNull(),
  path: text("path"),
  userId: integer("user_id").references(() => users.id),
  details: text("details").$type<Record<string, unknown>>(),
  aiAnalysis: text("ai_analysis").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Sub-purposes table definition with proper columns
export const subPurposes = pgTable("sub_purposes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  purpose_type: text("purpose_type").notNull(),
  is_frozen: boolean("is_frozen").notNull().default(false),
  valid_from: timestamp("valid_from"),
  valid_to: timestamp("valid_to"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

export const purchaseRequests = pgTable("purchase_requests", {
  id: serial("id").primaryKey(),
  requestNumber: text("request_number").unique().notNull(),
  requesterId: integer("requester_id").notNull().references(() => users.id),
  vendorId: integer("vendor_id").notNull().references(() => vendors.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  items: text("items").$type<Array<{
    name: string;
    quantity: number;
    estimatedCost: number;
    description?: string;
  }>>().notNull(),
  purposeType: text("purpose_type").notNull(),
  subPurposeId: integer("sub_purpose_id").references(() => subPurposes.id),
  priority: text("priority").notNull().default("medium"),
  priorityScore: integer("priority_score"),
  priorityReason: text("priority_reason"),
  priorityRecommendations: text("priority_recommendations").$type<string[]>(),
  currency: text("currency").notNull().default("QAR"),
  totalEstimatedCost: integer("total_estimated_cost").notNull(),
  freightAmount: integer("freight_amount").notNull().default(0),
  status: text("status").notNull().default("draft"),
  isLocked: boolean("is_locked").notNull().default(false),
  mandatoryApproversCount: integer("mandatory_approvers_count").notNull().default(0),
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
  isMandatory: boolean("is_mandatory").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const fileAttachments = pgTable("file_attachments", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull().references(() => purchaseRequests.id),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  fileUrl: text("file_url").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});


export const purchaseApprovers = pgTable("purchase_approvers", {
  id: serial("id").primaryKey(),
  departmentId: text("department").notNull(),
  approverId: integer("approver_id").notNull().references(() => users.id),
  isMandatory: boolean("is_mandatory").notNull().default(false),
  level: integer("level").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Vendor Management Tables
export const vendors = pgTable("vendors", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull(),
  contactPerson: text("contact_person").notNull(),
  contactNumber: text("contact_number").notNull(),
  email: text("email").notNull(),
  address: text("address").notNull(),
  taxNumber: text("tax_number"),
  registrationNumber: text("registration_number"),
  bankName: text("bank_name").notNull(),
  accountNumber: text("account_number").notNull(),
  ibanNumber: text("iban_number").notNull(),
  branchName: text("branch_name").notNull(),
  category: text("category").default("general"),
  payment_currency: text("payment_currency").notNull().default("QAR"),
  rating: integer("rating").default(0),
  status: text("status").notNull().default("active"),
  remarks: text("remarks"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const vendorCategories = pgTable("vendor_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const vendorToCategories = pgTable("vendor_to_categories", {
  id: serial("id").primaryKey(),
  vendorId: integer("vendor_id").notNull().references(() => vendors.id),
  categoryId: integer("category_id").notNull().references(() => vendorCategories.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const vendorPerformance = pgTable("vendor_performance", {
  id: serial("id").primaryKey(),
  vendorId: integer("vendor_id").notNull().references(() => vendors.id),
  requestId: integer("request_id").references(() => purchaseRequests.id),
  qualityScore: integer("quality_score").notNull(),
  deliveryScore: integer("delivery_score").notNull(),
  communicationScore: integer("communication_score").notNull(),
  costScore: integer("cost_score").notNull(),
  comments: text("comments"),
  reviewedBy: integer("reviewed_by").notNull().references(() => users.id),
  reviewedAt: timestamp("reviewed_at").defaultNow(),
});

export const vendorPayments = pgTable("vendor_payments", {
  id: serial("id").primaryKey(),
  vendorId: integer("vendor_id").notNull().references(() => vendors.id),
  requestId: integer("request_id").references(() => purchaseRequests.id),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("QAR"),
  status: text("status").notNull().default("pending"),
  dueDate: timestamp("due_date").notNull(),
  paidAt: timestamp("paid_at"),
  transactionReference: text("transaction_reference"),
  remarks: text("remarks"),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============= Relations =============
export const errorLogRelations = relations(errorLogs, ({ one }) => ({
  user: one(users, {
    fields: [errorLogs.userId],
    references: [users.id],
  }),
}));

export const userRelations = relations(users, ({ many }) => ({
  requestsCreated: many(purchaseRequests),
  approvalsGiven: many(approvals),
  notifications: many(notifications),
}));

export const notificationRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  request: one(purchaseRequests, {
    fields: [notifications.requestId],
    references: [purchaseRequests.id],
  }),
}));

export const purchaseRequestRelations = relations(purchaseRequests, ({ one, many }) => ({
  requester: one(users, {
    fields: [purchaseRequests.requesterId],
    references: [users.id],
  }),
  approvals: many(approvals),
  subPurpose: one(subPurposes, {
    fields: [purchaseRequests.subPurposeId],
    references: [subPurposes.id],
  }),
  attachments: many(fileAttachments),
  vendor: one(vendors, {
    fields: [purchaseRequests.vendorId],
    references: [vendors.id],
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

export const fileAttachmentRelations = relations(fileAttachments, ({ one }) => ({
  request: one(purchaseRequests, {
    fields: [fileAttachments.requestId],
    references: [purchaseRequests.id],
  }),
}));

// Relations
export const vendorRelations = relations(vendors, ({ many }) => ({
  categories: many(vendorToCategories),
  performance: many(vendorPerformance),
  payments: many(vendorPayments),
}));

export const vendorCategoryRelations = relations(vendorCategories, ({ many }) => ({
  vendors: many(vendorToCategories),
}));

export const vendorToCategoriesRelations = relations(vendorToCategories, ({ one }) => ({
  vendor: one(vendors, {
    fields: [vendorToCategories.vendorId],
    references: [vendors.id],
  }),
  category: one(vendorCategories, {
    fields: [vendorToCategories.categoryId],
    references: [vendorCategories.id],
  }),
}));


// ============= Basic Type Definitions =============
export type User = InferModel<typeof users>;
export type SubPurpose = {
  id: number;
  name: string;
  purpose_type: string;
  is_frozen: boolean;
  valid_from: Date | null;
  valid_to: Date | null;
  created_at: Date | null;
  updated_at: Date | null;
};
export type PurchaseRequest = InferModel<typeof purchaseRequests>;
export type Approval = InferModel<typeof approvals>;
export type FileAttachment = InferModel<typeof fileAttachments>;
export type NotificationType = InferModel<typeof notifications>;
export type AccountRequest = InferModel<typeof accountRequests>;
export type ErrorLog = typeof errorLogs.$inferSelect;
export type InsertErrorLog = typeof errorLogs.$inferInsert;
export type LoginCredentials = z.infer<typeof loginSchema>;
export type InsertUser = typeof users.$inferInsert;
export type SelectUser = typeof users.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;
export type SelectNotification = typeof notifications.$inferSelect;
export type PurchaseApprover = typeof purchaseApprovers.$inferSelect;
export type InsertSubPurpose = typeof subPurposes.$inferInsert;
export type Vendor = typeof vendors.$inferSelect;
export type InsertVendor = typeof vendors.$inferInsert;
export type VendorCategory = typeof vendorCategories.$inferSelect;
export type VendorPerformance = typeof vendorPerformance.$inferSelect;
export type VendorPayment = typeof vendorPayments.$inferSelect;



// ============= Validation Schemas =============
export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const insertUserSchema = createInsertSchema(users, {
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  email: z.string().email("Invalid email format"),
  contact_number: z.string()
    .min(8, "Contact number must be at least 8 digits")
    .max(15, "Contact number cannot exceed 15 digits")
    .regex(/^[+]?[\d\s-]+$/, "Invalid contact number format"),
  department: z.string().min(1, "Department is required"),
  role: z.enum(["user", "approver", "admin"]).default("user"),
});

// SubPurpose validation schema with proper purpose types
export const insertSubPurposeSchema = createInsertSchema(subPurposes, {
  name: z.string().min(1, "Name is required"),
  purpose_type: z.enum(["E3 EVENT", "PROJECT", "MALL", "BUSINESS GROWTH"], {
    required_error: "Purpose type is required",
    invalid_type_error: "Must be one of: E3 EVENT, PROJECT, MALL, BUSINESS GROWTH"
  }),
  is_frozen: z.boolean().default(false),
  valid_from: z.coerce.date().optional().nullable(),
  valid_to: z.coerce.date().optional().nullable(),
  created_at: z.coerce.date().optional(),
  updated_at: z.coerce.date().optional()
});

export const insertAccountRequestSchema = createInsertSchema(accountRequests, {
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  email: z.string().email("Invalid email format"),
  contact_number: z.string()
    .min(8, "Contact number must be at least 8 digits")
    .max(15, "Contact number cannot exceed 15 digits")
    .regex(/^[+]?[\d\s-]+$/, "Invalid contact number format"),
  department: z.string().min(1, "Department is required"),
  role: z.enum(["user", "approver", "admin"]).default("user"),
  status: z.enum(["pending", "approved", "rejected"]).default("pending"),
});

// Update PurchaseRequest schema to use the same purpose types
export const insertPurchaseRequestSchema = createInsertSchema(purchaseRequests, {
  title: z.string()
    .min(1, "Title is required")
    .max(100, "Title cannot exceed 100 characters")
    .optional(),
  description: z.string()
    .min(10, "Description must be at least 10 characters")
    .max(500, "Description cannot exceed 500 characters")
    .optional(),
  items: z.array(z.object({
    name: z.string()
      .min(1, "Item name is required")
      .max(100, "Item name cannot exceed 100 characters"),
    quantity: z.number()
      .positive("Quantity must be greater than 0")
      .multipleOf(0.01, "Quantity can have up to 2 decimal places")
      .max(999999.99, "Quantity is too large"),
    estimatedCost: z.number()
      .min(0, "Cost cannot be negative")
      .multipleOf(0.01, "Cost can have up to 2 decimal places")
      .max(999999999.99, "Cost is too large"),
    description: z.string()
      .max(200, "Item description cannot exceed 200 characters")
      .optional()
  })).optional().default([]),
  purposeType: z.enum(["E3 EVENT", "PROJECT", "MALL", "BUSINESS GROWTH"], {
    required_error: "Purpose type is required",
    invalid_type_error: "Must be one of: E3 EVENT, PROJECT, MALL, BUSINESS GROWTH"
  }).optional(),
  vendorId: z.number().int().positive("Vendor selection is required").optional(),
  subPurposeId: z.number().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  currency: z.enum(["QAR", "USD", "CNY"]).optional(),
  totalEstimatedCost: z.number()
    .multipleOf(0.01, "Total cost can have up to 2 decimal places")
    .min(0, "Total cost cannot be negative")
    .max(999999999.99, "Total cost is too large")
    .optional(),
  freightAmount: z.number()
    .multipleOf(0.01, "Freight amount can have up to 2 decimal places")
    .min(0, "Freight amount cannot be negative")
    .max(999999999.99, "Freight amount is too large")
    .optional()
    .default(0),
  status: z.enum(["draft", "pending", "approved", "rejected", "changes_requested"]).optional(),
  isLocked: z.boolean().optional(),
  mandatoryApproversCount: z.number().int().min(0).optional(),
  requestNumber: z.string().optional(),
  requesterId: z.number().optional(),
  priorityScore: z.number().optional(),
  priorityReason: z.string().optional(),
  priorityRecommendations: z.array(z.string()).optional(),
});

export const insertPurchaseApproverSchema = createInsertSchema(purchaseApprovers, {
  departmentId: z.string().min(1, "Department is required"),
  approverId: z.number().int().positive("Invalid approver ID"),
  isMandatory: z.boolean().default(false),
  level: z.number().int().min(1).max(5),
});

// Update the vendor schema validation
export const insertVendorSchema = createInsertSchema(vendors, {
  companyName: z.string().min(2, "Company name must be at least 2 characters"),
  contactPerson: z.string().min(2, "Contact person name must be at least 2 characters"),
  contactNumber: z.string()
    .min(8, "Contact number must be at least 8 digits")
    .max(15, "Contact number cannot exceed 15 digits")
    .regex(/^[+]?[\d\s-]+$/, "Invalid contact number format"),
  email: z.string().email("Invalid email format"),
  address: z.string().min(5, "Address must be at least 5 characters"),
  taxNumber: z.string().optional(),
  registrationNumber: z.string().optional(),
  bankName: z.string().min(2, "Bank name must be at least 2 characters"),
  accountNumber: z.string()
    .min(5, "Account number must be at least 5 characters")
    .regex(/^[\w-]+$/, "Account number can only contain letters, numbers, and hyphens"),
  ibanNumber: z.string()
    .min(15, "IBAN must be at least 15 characters")
    .regex(/^[A-Z0-9]+$/, "IBAN must contain only uppercase letters and numbers"),
  branchName: z.string().min(2, "Branch name must be at least 2 characters"),
  category: z.string().default("general"),
  payment_currency: z.enum(["QAR", "USD", "CNY"]).default("QAR"),
  remarks: z.string().optional(),
  status: z.enum(["active", "blocked", "frozen"]).default("active"),
});

export const insertVendorCategorySchema = createInsertSchema(vendorCategories, {
  name: z.string().min(2, "Category name must be at least 2 characters"),
  description: z.string().optional(),
});

export const insertVendorPerformanceSchema = createInsertSchema(vendorPerformance, {
  qualityScore: z.number().min(1).max(5),
  deliveryScore: z.number().min(1).max(5),
  communicationScore: z.number().min(1).max(5),
  costScore: z.number().min(1).max(5),
  comments: z.string().optional(),
});

export const insertVendorPaymentSchema = createInsertSchema(vendorPayments, {
  amount: z.number().positive("Amount must be greater than 0"),
  currency: z.enum(["QAR", "USD", "CNY"]).default("QAR"),
  status: z.enum(["pending", "paid", "cancelled"]).default("pending"),
  dueDate: z.coerce.date(),
  transactionReference: z.string().optional(),
  remarks: z.string().optional(),
});

// ============= Create Select Schemas =============
export const selectUserSchema = createSelectSchema(users);
export const selectAccountRequestSchema = createSelectSchema(accountRequests);
export const selectNotificationSchema = createSelectSchema(notifications);
export const selectPurchaseRequestSchema = createSelectSchema(purchaseRequests);
export const selectApprovalSchema = createSelectSchema(approvals);
export const selectFileAttachmentSchema = createSelectSchema(fileAttachments);
export const selectPurchaseApproverSchema = createSelectSchema(purchaseApprovers);

// Using createSelectSchema for error logs with proper typing
export const selectErrorLogSchema = createSelectSchema(errorLogs);

export const selectSubPurposeSchema = createSelectSchema(subPurposes);
export const selectVendorSchema = createSelectSchema(vendors);
export const selectVendorCategorySchema = createSelectSchema(vendorCategories);
export const selectVendorPerformanceSchema = createSelectSchema(vendorPerformance);
export const selectVendorPaymentSchema = createSelectSchema(vendorPayments);

// ============= Error log schemas =============
export const insertErrorLogSchema = z.object({
  message: z.string().min(1, "Message is required"),
  code: z.string().optional(),
  severity: z.enum(["critical", "error", "warning", "info"]),
  path: z.string().optional(),
  userId: z.number().optional(),
  details: z.record(z.unknown()).optional(),
  aiAnalysis: z.record(z.unknown()).optional(),
});

// ============= Department Constants =============
export const mandatoryDepartments = [
  "Business",
  "Management",
  "Operation",
  "Support",
  "Finance",
  "Director",
  "CEO Office",
  "Sales",
  "Marketing",
  "Business Growth",
  "Branding",
  "Logistics",
  "Mall Activations",
  "Information Technology",
  "HR",
  "Procurement",
  "Legal",
  "Research and Development",
  "Quality Assurance",
  "Customer Service",
  "Project Management",
  "Administration"
] as const;

export type MandatoryDepartment = typeof mandatoryDepartments[number];