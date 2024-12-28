import { pgTable, text, serial, integer, boolean, timestamp, json, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations, type InferModel } from "drizzle-orm";
import { z } from "zod";

// Define tables
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

// Account Requests Table
export const accountRequests = pgTable("account_requests", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
  email: text("email").notNull(),
  contact_number: text("contact_number").notNull(),
  department: text("department").notNull(),
  purpose: text("purpose").notNull(),
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

export const subPurposes = pgTable("sub_purposes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  purposeType: text("purpose_type").notNull(),
  isFrozen: boolean("is_frozen").notNull().default(false),
  validFrom: timestamp("valid_from"),
  validTo: timestamp("valid_to"),
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
    description?: string;
  }>>().notNull(),
  companyName: text("company_name").notNull(),
  contactPerson: text("contact_person").notNull(),
  contact_number: text("contact_number").notNull(),
  accountNumber: text("account_number").notNull(),
  purpose: text("purpose").notNull().default(""),
  purposeType: text("purpose_type").notNull(),
  subPurposeId: integer("sub_purpose_id").references(() => subPurposes.id),
  priority: text("priority").notNull().default("medium"),
  priorityScore: integer("priority_score"),
  priorityReason: text("priority_reason"),
  priorityRecommendations: json("priority_recommendations").$type<string[]>(),
  currency: text("currency").notNull().default("QAR"),
  totalEstimatedCost: decimal("total_estimated_cost", { precision: 10, scale: 2 }).notNull(),
  freightAmount: decimal("freight_amount", { precision: 10, scale: 2 }).notNull().default('0'),
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

export const companyBranding = pgTable("company_branding", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull(),
  headerStyle: text("header_style").notNull().default("modern"),
  primaryColor: text("primary_color").notNull().default("#71569E"),
  secondaryColor: text("secondary_color").notNull().default("#F0F0FA"),
  accentColor: text("accent_color").notNull().default("#191160"),
  logoUrl: text("logo_url"),
  footerText: text("footer_text"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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

// Add after the existing tables, before validation schemas
export const errorLogs = pgTable("error_logs", {
  id: serial("id").primaryKey(),
  message: text("message").notNull(),
  code: text("code"),
  severity: text("severity").notNull(),
  path: text("path"),
  userId: integer("user_id").references(() => users.id),
  details: json("details").$type<Record<string, unknown>>(),
  aiAnalysis: json("ai_analysis").$type<{
    prediction: string;
    suggestions: string[];
    preventiveMeasures: string[];
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const errorLogRelations = relations(errorLogs, ({ one }) => ({
  user: one(users, {
    fields: [errorLogs.userId],
    references: [users.id],
  }),
}));

// Type definitions
export type User = InferModel<typeof users>;
export type SubPurpose = InferModel<typeof subPurposes>;
export type PurchaseRequest = InferModel<typeof purchaseRequests>;
export type Approval = InferModel<typeof approvals>;
export type FileAttachment = InferModel<typeof fileAttachments>;
export type NotificationType = InferModel<typeof notifications>;
export type CompanyBranding = InferModel<typeof companyBranding>;
export type AccountRequest = InferModel<typeof accountRequests>;
export type ErrorLog = typeof errorLogs.$inferSelect;
export type InsertErrorLog = typeof errorLogs.$inferInsert;

// Relations
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

// Validation Schemas
export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const insertCompanyBrandingSchema = createInsertSchema(companyBranding, {
  headerStyle: z.enum(["modern", "classic", "minimal"]),
  primaryColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid hex color"),
  secondaryColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid hex color"),
  accentColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid hex color"),
  logoUrl: z.string().optional(),
  footerText: z.string().optional(),
});

export const insertUserSchema = createInsertSchema(users, {
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  email: z.string().email("Invalid email format"),
  contact_number: z.string()
    .min(8, "Contact number must be at least 8 digits")
    .max(15, "Contact number cannot exceed 15 digits")
    .regex(/^[+]?[\d\s-]+$/, "Invalid contact number format. Use only numbers, spaces, hyphens, or + symbol"),
  department: z.string().min(1, "Department is required"),
  role: z.enum(["user", "approver", "admin"]).default("user"),
});

// Account Request Schema
export const insertAccountRequestSchema = createInsertSchema(accountRequests, {
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  email: z.string().email("Invalid email format"),
  contact_number: z.string()
    .trim()
    .min(1, "Contact number is required")
    .min(8, "Contact number must be at least 8 digits")
    .max(15, "Contact number cannot exceed 15 digits")
    .regex(/^[+]?[\d\s-]+$/, "Invalid contact number format"),
  purpose: z.string()
    .trim()
    .min(1, "Purpose is required")
    .min(3, "Purpose must be at least 3 characters"),
  department: z.string()
    .min(1, "Department is required")
    .refine((val) => mandatoryDepartments.includes(val as any), "Invalid department"),
  role: z.enum(["user", "approver", "admin"]).default("user"),
  status: z.enum(["pending", "approved", "rejected"]).default("pending"),
});

export const insertNotificationSchema = createInsertSchema(notifications);
export const selectNotificationSchema = createSelectSchema(notifications);

// Types from schemas
export type LoginCredentials = z.infer<typeof loginSchema>;
export type InsertNotification = typeof notifications.$inferInsert;
export const selectCompanyBrandingSchema = createSelectSchema(companyBranding);
export const selectUserSchema = createSelectSchema(users);
export type InsertUser = typeof users.$inferInsert;
export type SelectUser = typeof users.$inferSelect;
export const insertSubPurposeSchema = createInsertSchema(subPurposes, {
  name: z.string().min(1, "Name is required"),
  purposeType: z.enum(["event", "project", "mall", "business_growth"]),
  isFrozen: z.boolean().optional(),
  validFrom: z.string()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: "Invalid date format"
    })
    .transform((val) => val ? new Date(val).toISOString() : undefined)
    .optional(),
  validTo: z.string()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: "Invalid date format"
    })
    .transform((val) => val ? new Date(val).toISOString() : undefined)
    .optional(),
});
export const selectSubPurposeSchema = createSelectSchema(subPurposes);
export const insertPurchaseRequestSchema = createInsertSchema(purchaseRequests, {
  title: z.string()
    .min(1, "Title is required")
    .max(100, "Title cannot exceed 100 characters"),
  description: z.string()
    .min(10, "Description must be at least 10 characters")
    .max(500, "Description cannot exceed 500 characters"),
  items: z.array(z.object({
    name: z.string()
      .min(1, "Item name is required")
      .max(100, "Item name cannot exceed 100 characters"),
    quantity: z.number()
      .int("Quantity must be a whole number")
      .positive("Quantity must be a positive number")
      .max(999999, "Quantity is too large"),
    estimatedCost: z.number()
      .min(0, "Cost cannot be negative")
      .max(999999999, "Cost is too large"),
    description: z.string()
      .max(200, "Item description cannot exceed 200 characters")
      .optional()
  })).min(1, "At least one item is required"),
  companyName: z.string()
    .min(1, "Company name is required")
    .max(100, "Company name cannot exceed 100 characters"),
  contactPerson: z.string()
    .min(1, "Contact person is required")
    .max(100, "Contact person name cannot exceed 100 characters"),
  contact_number: z.string()
    .min(1, "Contact number is required")
    .min(8, "Contact number must be at least 8 digits")
    .max(15, "Contact number cannot exceed 15 digits")
    .regex(/^[+]?[\d\s-]+$/, "Invalid contact number format. Use only numbers, spaces, hyphens, or + symbol")
    .transform((val) => (val || "").trim()),
  accountNumber: z.string()
    .min(1, "Account number is required")
    .max(50, "Account number cannot exceed 50 characters")
    .regex(/^[\w-]+$/, "Account number can only contain letters, numbers, and hyphens"),
  purpose: z.string()
    .min(1, "Purpose is required")
    .max(200, "Purpose cannot exceed 200 characters")
    .transform((val) => (val || "").trim()),
  purposeType: z.enum(["event", "project", "mall", "business_growth"], {
    errorMap: () => ({ message: "Please select a valid purpose type" })
  }),
  subPurposeId: z.number().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"], {
    errorMap: () => ({ message: "Please select a valid priority level" })
  }),
  currency: z.enum(["QAR", "USD", "CNY"], {
    errorMap: () => ({ message: "Please select a valid currency" })
  }),
  totalEstimatedCost: z.coerce
    .number()
    .min(0, "Total cost cannot be negative")
    .max(999999999, "Total cost is too large"),
  freightAmount: z.coerce
    .number()
    .min(0, "Freight amount cannot be negative")
    .max(999999999, "Freight amount is too large"),
  status: z.enum(
    ["draft", "pending", "approved", "rejected", "changes_requested"],
    {
      errorMap: () => ({ message: "Invalid request status" })
    }
  ),
  isLocked: z.boolean().optional(),
  mandatoryApproversCount: z.number().int().min(0).optional(),
  requestNumber: z.string().optional(),
  requesterId: z.number().optional(),
  priorityScore: z.number().optional(),
  priorityReason: z.string().optional(),
  priorityRecommendations: z.array(z.string()).optional(),
});

export const selectPurchaseRequestSchema = createSelectSchema(purchaseRequests);
export const insertApprovalSchema = createInsertSchema(approvals);
export const selectApprovalSchema = createSelectSchema(approvals);
export const insertFileAttachmentSchema = createInsertSchema(fileAttachments);
export const selectFileAttachmentSchema = createSelectSchema(fileAttachments);
export const selectAccountRequestSchema = createSelectSchema(accountRequests);


// Department Constants
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

export type InsertAccountRequest = z.infer<typeof insertAccountRequestSchema>;


export const insertPurchaseApproverSchema = createInsertSchema(purchaseApprovers, {
  departmentId: z.string().min(1, "Department is required"),
  approverId: z.number().int().positive("Invalid approver ID"),
  isMandatory: z.boolean().default(false),
  level: z.number().int().min(1).max(5),
});

export const selectPurchaseApproverSchema = createSelectSchema(purchaseApprovers);
export type PurchaseApprover = typeof purchaseApprovers.$inferSelect;