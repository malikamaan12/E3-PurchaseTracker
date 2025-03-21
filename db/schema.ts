import { pgTable, text, serial, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { relations, type InferModel, sql } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

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

//notifications table with enhanced structure
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  requestId: integer("request_id").references(() => purchaseRequests.id),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull(),
  priority: text("priority").notNull().default('normal'), // 'high', 'normal', 'low'
  isRead: boolean("is_read").notNull().default(false),
  isAcknowledged: boolean("is_acknowledged").notNull().default(false),
  link: text("link"),
  actionType: text("action_type"), // Optional field for indicating action required
  actionData: jsonb("action_data").$type<Record<string, any>>(), // Optional data for action
  expiresAt: timestamp("expires_at"), // Optional expiration time
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
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const approvalAuditLogs = pgTable("approval_audit_logs", {
  id: serial("id").primaryKey(),
  approvalId: integer("approval_id").notNull().references(() => approvals.id),
  userId: integer("user_id").notNull().references(() => users.id),
  action: text("action").notNull(),
  previousStatus: text("previous_status"),
  newStatus: text("new_status").notNull(),
  comments: text("comments"),
  metadata: jsonb("metadata").$type<{
    userAgent?: string;
    ipAddress?: string;
    department?: string;
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
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
  notificationPreferences: many(notificationPreferences)
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

export const approvalRelations = relations(approvals, ({ one, many }) => ({
  request: one(purchaseRequests, {
    fields: [approvals.requestId],
    references: [purchaseRequests.id],
  }),
  approver: one(users, {
    fields: [approvals.approverId],
    references: [users.id],
  }),
  auditLogs: many(approvalAuditLogs)
}));

export const approvalAuditLogRelations = relations(approvalAuditLogs, ({ one }) => ({
  approval: one(approvals, {
    fields: [approvalAuditLogs.approvalId],
    references: [approvals.id],
  }),
  user: one(users, {
    fields: [approvalAuditLogs.userId],
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

// Add PurchaseRequestWithRelations type
export type PurchaseRequestWithRelations = PurchaseRequest & {
  requester?: User;
  approvals?: (Approval & { approver?: User })[];
  subPurpose?: SubPurpose;
  attachments?: FileAttachment[];
  vendor?: Vendor;
};

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
  // Make subPurposeId conditionally required only for PROJECT type
  subPurposeId: z.number().optional().superRefine((val, ctx) => {
    // When validating a full purchase request (not a draft)
    if (ctx.data && ctx.data.status !== 'draft') {
      // Only require for PROJECT type
      if (ctx.data.purposeType === 'PROJECT' && !val) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Sub-purpose is required for PROJECT type",
          path: ["subPurposeId"]
        });
      }
    }
  }),
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
  additionalApprovers: z.array(z.string()).optional().default([]),
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
  taxNumber: z.string().optional().nullable(),
  registrationNumber: z.string().optional().nullable(),
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
  remarks: z.string().optional().nullable(),
  status: z.enum(["active", "blocked", "frozen"]).default("active"),
});

// Use the same schema for form validation
export const vendorFormSchema = insertVendorSchema;

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

// Add after the existing notifications table definition
export const notificationPreferences = pgTable("notification_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  category: text("category").notNull(),
  type: text("type").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  inAppEnabled: boolean("in_app_enabled").notNull().default(true),
  emailEnabled: boolean("email_enabled").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Add notification categories and types as constants
export const NOTIFICATION_CATEGORIES = {
  REQUESTS: 'requests',
  APPROVALS: 'approvals',
  SYSTEM: 'system',
  VENDORS: 'vendors',
  ACCOUNT: 'account'
} as const;

export const NOTIFICATION_TYPES = {
  // Request related
  NEW_REQUEST: 'new_request',
  REQUEST_STATUS_CHANGE: 'request_status_change',
  REQUEST_COMMENT: 'request_comment',
  REQUEST_MENTION: 'request_mention',

  // Approval related
  PENDING_APPROVAL: 'pending_approval',
  APPROVAL_GRANTED: 'approval_granted',
  APPROVAL_REJECTED: 'approval_rejected',

  // System related
  SYSTEM_MAINTENANCE: 'system_maintenance',
  SYSTEM_UPDATE: 'system_update',

  // Vendor related
  VENDOR_STATUS_CHANGE: 'vendor_status_change',
  VENDOR_PERFORMANCE_UPDATE: 'vendor_performance_update',

  // Account related
  ACCOUNT_STATUS_CHANGE: 'account_status_change',
  PASSWORD_CHANGE: 'password_change',
  ROLE_CHANGE: 'role_change'
} as const;

// Add types
export type NotificationCategory = keyof typeof NOTIFICATION_CATEGORIES;
export type NotificationEventType = keyof typeof NOTIFICATION_TYPES;
export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreference = typeof notificationPreferences.$inferInsert;

// Fix the schema validation for notification preferences
export const insertNotificationPreferenceSchema = createInsertSchema(notificationPreferences, {
  category: z.enum([
    NOTIFICATION_CATEGORIES.REQUESTS,
    NOTIFICATION_CATEGORIES.APPROVALS,
    NOTIFICATION_CATEGORIES.SYSTEM,
    NOTIFICATION_CATEGORIES.VENDORS,
    NOTIFICATION_CATEGORIES.ACCOUNT
  ]),
  type: z.enum([
    NOTIFICATION_TYPES.NEW_REQUEST,
    NOTIFICATION_TYPES.REQUEST_STATUS_CHANGE,
    NOTIFICATION_TYPES.REQUEST_COMMENT,
    NOTIFICATION_TYPES.REQUEST_MENTION,
    NOTIFICATION_TYPES.PENDING_APPROVAL,
    NOTIFICATION_TYPES.APPROVAL_GRANTED,
    NOTIFICATION_TYPES.APPROVAL_REJECTED,
    NOTIFICATION_TYPES.SYSTEM_MAINTENANCE,
    NOTIFICATION_TYPES.SYSTEM_UPDATE,
    NOTIFICATION_TYPES.VENDOR_STATUS_CHANGE,
    NOTIFICATION_TYPES.VENDOR_PERFORMANCE_UPDATE,
    NOTIFICATION_TYPES.ACCOUNT_STATUS_CHANGE,
    NOTIFICATION_TYPES.PASSWORD_CHANGE,
    NOTIFICATION_TYPES.ROLE_CHANGE
  ]),
  enabled: z.boolean(),
  inAppEnabled: z.boolean(),
  emailEnabled: z.boolean()
});

// Add relations
export const notificationPreferenceRelations = relations(notificationPreferences, ({ one }) => ({
  user: one(users, {
    fields: [notificationPreferences.userId],
    references: [users.id]
  })
}));

export const vendorPaymentRelations = relations(vendorPayments, ({one, many}) => ({
    vendor: one(vendors, {
        fields: [vendorPayments.vendorId],
        references: [vendors.id]
    }),
    request: one(purchaseRequests, {
        fields: [vendorPayments.requestId],
        references: [purchaseRequests.id]
    })
}))

export const vendorPerformanceRelations = relations(vendorPerformance, ({one, many}) => ({
    vendor: one(vendors, {
        fields: [vendorPerformance.vendorId],
        references: [vendors.id]
    }),
    request: one(purchaseRequests, {
        fields: [vendorPerformance.requestId],
        references: [purchaseRequests.id]
    })
}))

// Update AuditAction type to include PDF operations
export type AuditAction = 'pdf_generated' | 'pdf_downloaded' | 'pdf_viewed' | 
  'csv_downloaded' | 'excel_downloaded' | 'zip_downloaded' | 'pdf_analyzed';

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("userid").references(() => users.id),
  action: text("action").notNull(),
  resourceId: integer("resourceid"),
  resourceType: text("resourcetype"),
  details: jsonb("details").$type<Record<string, any>>(),
  ipAddress: text("ipaddress"),
  userAgent: text("useragent"),
  timestamp: timestamp("timestamp").defaultNow()
});

// Add pdfSettings table after the auditLogs table
export const pdfSettings = pgTable("pdf_settings", {
  id: serial("id").primaryKey(),
  headerTitle: text("header_title").notNull(),
  headerSubtitle: text("header_subtitle"),
  headerColor: text("header_color").notNull(),
  footerText: text("footer_text"),
  footerColor: text("footer_color").notNull(),
  pageNumbering: boolean("page_numbering").notNull().default(true),
  watermarkOpacity: integer("watermark_opacity").notNull().default(10),
  watermarkText: text("watermark_text").default("CONFIDENTIAL"),
  marginTop: integer("margin_top").notNull().default(20),
  marginBottom: integer("margin_bottom").notNull().default(20),
  marginLeft: integer("margin_left").notNull().default(25),
  marginRight: integer("margin_right").notNull().default(25),
  fontSize: integer("font_size").notNull().default(11),
  fontFamily: text("font_family").default("helvetica"),
  headerImage: text("header_image"),
  footerImage: text("footer_image"),
  logo: text("logo"),
  logoPosition: text("logo_position").default("left"),
  loginLogo: text("login_logo"),
  headerHeight: integer("header_height").notNull().default(100),
  footerHeight: integer("footer_height").notNull().default(50),
  companyAddress: text("company_address"),
  companyPhone: text("company_phone"),
  companyEmail: text("company_email"),
  companyWebsite: text("company_website"),
  showBasicInfo: boolean("show_basic_info").default(true),
  showRequesterDetails: boolean("show_requester_details").default(true),
  showDateOfRequest: boolean("show_date_of_request").default(true),
  showPurposeInfo: boolean("show_purpose_info").default(true),
  showVendorDetails: boolean("show_vendor_details").default(true),
  showItems: boolean("show_items").default(true),
  showApprovals: boolean("show_approvals").default(true),
  showAttachments: boolean("show_attachments").default(true),
  showAuditInfo: boolean("show_audit_info").default(false),
  showSignatures: boolean("show_signatures").default(true),
  templateConfig: text("template_config"), // Store template configuration as JSON
  userId: integer("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Add schema validation
export const insertPdfSettingsSchema = createInsertSchema(pdfSettings, {
  headerTitle: z.string().min(1, "Header title is required"),
  headerSubtitle: z.string().optional(),
  headerColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format"),
  footerText: z.string().optional(),
  footerColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format"),
  pageNumbering: z.boolean().default(true),
  watermarkOpacity: z.number().min(0).max(100).default(10),
  watermarkText: z.string().optional().default("CONFIDENTIAL"),
  marginTop: z.number().min(10).max(50).default(20),
  marginBottom: z.number().min(10).max(50).default(20),
  marginLeft: z.number().min(15).max(50).default(25),
  marginRight: z.number().min(15).max(50).default(25),
  fontSize: z.number().min(8).max(16).default(11),
  fontFamily: z.string().optional().default("helvetica"),
  headerImage: z.string().optional().nullable(),
  footerImage: z.string().optional().nullable(),
  logo: z.string().optional().nullable(),
  logoPosition: z.enum(["left", "center", "right"]).default("left"),
  loginLogo: z.string().optional().nullable(),
  headerHeight: z.number().min(20).max(200).default(100),
  footerHeight: z.number().min(20).max(200).default(50),
  companyAddress: z.string().optional(),
  companyPhone: z.string().optional(),
  companyEmail: z.string().optional(),
  companyWebsite: z.string().optional(),
  showBasicInfo: z.boolean().default(true),
  showRequesterDetails: z.boolean().default(true),
  showDateOfRequest: z.boolean().default(true),
  showPurposeInfo: z.boolean().default(true),
  showVendorDetails: z.boolean().default(true),
  showItems: z.boolean().default(true),
  showApprovals: z.boolean().default(true),
  showAttachments: z.boolean().default(true),
  showAuditInfo: z.boolean().default(false),
  showSignatures: z.boolean().default(true),
  templateConfig: z.string().optional().nullable(), // JSON string for template configuration
  userId: z.number().optional(),
});

// Add relations
export const pdfSettingsRelations = relations(pdfSettings, ({ one }) => ({
  user: one(users, {
    fields: [pdfSettings.userId],
    references: [users.id],
  }),
}));

// Add types
export type PdfSettings = typeof pdfSettings.$inferSelect;
export type InsertPdfSettings = typeof pdfSettings.$inferInsert;