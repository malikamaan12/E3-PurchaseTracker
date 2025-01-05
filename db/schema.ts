import { pgTable, text, serial, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { relations, type InferModel } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Company Branding table with enhanced PDF and style management
export const companyBranding = pgTable("company_branding", {
  id: serial("id").primaryKey(),
  // Basic company info
  companyName: text("company_name").notNull(),
  description: text("description"),

  // Theme configuration
  primaryColor: text("primary_color").notNull().default("#71569E"),
  secondaryColor: text("secondary_color").notNull().default("#F0F0FA"),
  accentColor: text("accent_color").notNull().default("#191160"),
  fontFamily: text("font_family").notNull().default("Arial"),
  theme: text("theme").notNull().default("light"),

  // Header configuration
  headerConfig: jsonb("header_config").$type<{
    style: "modern" | "classic" | "minimal";
    textAlignment: "left" | "center" | "right";
    showLogo: boolean;
    showDate: boolean;
    showPageNumber: boolean;
    customText: string;
    fontSize: number;
  }>().notNull().default({
    style: "modern",
    textAlignment: "left",
    showLogo: true,
    showDate: true,
    showPageNumber: true,
    customText: "",
    fontSize: 12
  }),

  // Footer configuration
  footerConfig: jsonb("footer_config").$type<{
    showLogo: boolean;
    textAlignment: "left" | "center" | "right";
    showPageNumber: boolean;
    showCopyright: boolean;
    customText: string;
    fontSize: number;
  }>().notNull().default({
    showLogo: false,
    textAlignment: "center",
    showPageNumber: true,
    showCopyright: true,
    customText: "",
    fontSize: 10
  }),

  // Assets
  logo: text("logo"),
  logoMimeType: text("logo_mime_type"),
  headerImage: text("header_image"),
  headerImageMimeType: text("header_image_mime_type"),
  footerImage: text("footer_image"),
  footerImageMimeType: text("footer_image_mime_type"),

  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Branding validation schemas
const headerConfigSchema = z.object({
  style: z.enum(["modern", "classic", "minimal"]).default("modern"),
  textAlignment: z.enum(["left", "center", "right"]).default("left"),
  showLogo: z.boolean().default(true),
  showDate: z.boolean().default(true),
  showPageNumber: z.boolean().default(true),
  customText: z.string().optional(),
  fontSize: z.number().min(8).max(24).default(12)
});

const footerConfigSchema = z.object({
  showLogo: z.boolean().default(false),
  textAlignment: z.enum(["left", "center", "right"]).default("center"),
  showPageNumber: z.boolean().default(true),
  showCopyright: z.boolean().default(true),
  customText: z.string().optional(),
  fontSize: z.number().min(8).max(24).default(10)
});

export const insertCompanyBrandingSchema = createInsertSchema(companyBranding, {
  companyName: z.string().min(1, "Company name is required"),
  description: z.string().optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format"),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format"),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format"),
  fontFamily: z.string(),
  theme: z.enum(["light", "dark"]),
  headerConfig: headerConfigSchema,
  footerConfig: footerConfigSchema,
});

export const selectCompanyBrandingSchema = createSelectSchema(companyBranding);

// Type definitions
export type CompanyBranding = InferModel<typeof companyBranding>;
export type InsertCompanyBranding = z.infer<typeof insertCompanyBrandingSchema>;
export type HeaderConfig = z.infer<typeof headerConfigSchema>;
export type FooterConfig = z.infer<typeof footerConfigSchema>;

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

//accountRequests table
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

//notifications table
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
export type SubPurpose = InferModel<typeof subPurposes>;
export type PurchaseRequest = InferModel<typeof purchaseRequests>;
export type Approval = InferModel<typeof approvals>;
export type FileAttachment = InferModel<typeof fileAttachments>;
export type NotificationType = InferModel<typeof notifications>;
export type AccountRequest = InferModel<typeof accountRequests>;
export type ErrorLog = InferModel<typeof errorLogs>;
export type InsertErrorLog = InferModel<typeof errorLogs, "insert">;
export type LoginCredentials = z.infer<typeof loginSchema>;
export type InsertUser = InferModel<typeof users, "insert">;
export type SelectUser = InferModel<typeof users, "select">;
export type InsertNotification = InferModel<typeof notifications, "insert">;
export type SelectNotification = InferModel<typeof notifications, "select">;
export type PurchaseApprover = InferModel<typeof purchaseApprovers>;
export type InsertSubPurpose = InferModel<typeof subPurposes, "insert">;
export type Vendor = InferModel<typeof vendors>;
export type InsertVendor = InferModel<typeof vendors, "insert">;
export type VendorCategory = InferModel<typeof vendorCategories>;
export type VendorPerformance = InferModel<typeof vendorPerformance>;
export type VendorPayment = InferModel<typeof vendorPayments>;


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