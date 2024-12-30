import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// User table schema
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

// Validation schemas
export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const insertUserSchema = createInsertSchema(users, {
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  email: z.string().email("Invalid email format"),
  contact_number: z.string()
    .min(8, "Contact number must be at least 8 digits")
    .max(15, "Contact number cannot exceed 15 digits"),
  department: z.string().min(1, "Department is required"),
  role: z.enum(["user", "approver", "admin"]).default("user"),
});

export const selectUserSchema = createSelectSchema(users);

// Types
export type LoginCredentials = z.infer<typeof loginSchema>;
export type InsertUser = typeof users.$inferInsert;
export type SelectUser = typeof users.$inferSelect;

// Extend Express.User interface
declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

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
  updatedAt: timestamp("updated_at").defaultNow(),
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
  vendorId: integer("vendor_id").references(() => vendors.id),
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
  currency: text("currency").notNull().default("QAR"),
  totalEstimatedCost: integer("total_estimated_cost").notNull(),
  freightAmount: integer("freight_amount").notNull().default(0),
  status: text("status").notNull().default("draft"),
  isLocked: boolean("is_locked").notNull().default(false),
  mandatoryApproversCount: integer("mandatory_approvers_count").notNull().default(0),
  priorityScore: integer("priority_score"),
  priorityReason: text("priority_reason"),
  priorityRecommendations: text("priority_recommendations").$type<string[]>(),
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

export const companyBranding = pgTable("company_branding", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull(),
  headerStyle: text("header_style").notNull().default("modern"),
  primaryColor: text("primary_color").notNull().default("#71569E"),
  secondaryColor: text("secondary_color").notNull().default("#F0F0FA"),
  accentColor: text("accent_color").notNull().default("#191160"),
  logo: text("logo"),
  logoMimeType: text("logo_mime_type"),
  headerImageUrl: text("header_image_url"),
  headerImageMimeType: text("header_image_mime_type"),
  footerImageUrl: text("footer_image_url"),
  footerImageMimeType: text("footer_image_mime_type"),
  footerText: text("footer_text"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

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

export const purchaseRequestRelations = relations(purchaseRequests, ({ one }) => ({
  requester: one(users, {
    fields: [purchaseRequests.requesterId],
    references: [users.id],
  }),
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

export const vendorRelations = relations(vendors, ({ many }) => ({
  purchaseRequests: many(purchaseRequests),
}));

export type User = InferModel<typeof users>;
export type SubPurpose = InferModel<typeof subPurposes>;
export type PurchaseRequest = z.infer<typeof insertPurchaseRequestSchema>;
export type Approval = InferModel<typeof approvals>;
export type FileAttachment = InferModel<typeof fileAttachments>;
export type NotificationType = InferModel<typeof notifications>;
export type CompanyBranding = InferModel<typeof companyBranding>;
export type AccountRequest = InferModel<typeof accountRequests>;
export type ErrorLog = typeof errorLogs.$inferSelect;
export type InsertErrorLog = typeof errorLogs.$inferInsert;
export type InsertUser = typeof users.$inferInsert;
export type SelectUser = typeof users.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;
export type SelectNotification = typeof notifications.$inferSelect;
export type Vendor = typeof vendors.$inferSelect;
export type InsertVendor = typeof vendors.$inferInsert;


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

export const insertPurchaseRequestSchema = z.object({
  requestNumber: z.string(),
  requesterId: z.number(),
  title: z.string().min(1, "Title is required").max(100, "Title cannot exceed 100 characters"),
  description: z.string().min(10, "Description must be at least 10 characters").max(500, "Description cannot exceed 500 characters"),
  items: z.array(z.object({
    name: z.string().min(1, "Item name is required").max(100, "Item name cannot exceed 100 characters"),
    quantity: z.number().positive("Quantity must be greater than 0").max(999999.99, "Quantity is too large"),
    estimatedCost: z.number().min(0, "Cost cannot be negative").max(999999999.99, "Cost is too large"),
    description: z.string().max(200, "Item description cannot exceed 200 characters").optional()
  })).min(1, "At least one item is required"),
  purposeType: z.enum(["E3 EVENT", "PROJECT", "MALL", "BUSINESS GROWTH"]),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  currency: z.enum(["QAR", "USD", "CNY"]).default("QAR"),
  totalEstimatedCost: z.number().min(0, "Total cost cannot be negative").max(999999999.99, "Total cost is too large"),
  freightAmount: z.number().min(0, "Freight amount cannot be negative").max(999999999.99, "Freight amount is too large").default(0),
  status: z.enum(["draft", "pending", "approved", "rejected", "changes_requested"]).default("draft"),
  isLocked: z.boolean().default(false),
  mandatoryApproversCount: z.number().int().min(0).default(0),
  vendorId: z.number().int().positive().optional(),
  subPurposeId: z.number().int().positive().optional(),
  priorityScore: z.number().int().optional(),
  priorityReason: z.string().optional(),
  priorityRecommendations: z.array(z.string()).optional(),
});

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

export const insertErrorLogSchema = z.object({
  message: z.string().min(1, "Message is required"),
  code: z.string().optional(),
  severity: z.enum(["critical", "error", "warning", "info"]),
  path: z.string().optional(),
  userId: z.number().optional(),
  details: z.record(z.unknown()).optional(),
  aiAnalysis: z.record(z.unknown()).optional(),
});

export const selectAccountRequestSchema = createSelectSchema(accountRequests);
export const selectNotificationSchema = createSelectSchema(notifications);
export const selectPurchaseRequestSchema = createSelectSchema(purchaseRequests);
export const selectApprovalSchema = createSelectSchema(approvals);
export const selectFileAttachmentSchema = createSelectSchema(fileAttachments);
export const selectCompanyBrandingSchema = createSelectSchema(companyBranding);
export const selectSubPurposeSchema = createSelectSchema(subPurposes);
export const selectVendorSchema = createSelectSchema(vendors);

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