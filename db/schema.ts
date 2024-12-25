import { pgTable, text, serial, integer, boolean, timestamp, json, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations, type InferModel } from "drizzle-orm";
import { z } from "zod";

// Define the tables first without relations
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
  email: text("email").notNull(),
  contactNumber: text("contact_number").notNull(),
  department: text("department").notNull(),
  role: text("role").notNull().default("user"),
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
    description?: string; // Added description field as optional
  }>>().notNull(),
  companyName: text("company_name").notNull(),
  contactPerson: text("contact_person").notNull(),
  contactNumber: text("contact_number").notNull(),
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

export const fileAttachments = pgTable("file_attachments", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull().references(() => purchaseRequests.id),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  fileUrl: text("file_url").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
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

export const accountRequests = pgTable("account_requests", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
  email: text("email").notNull(),
  contactNumber: text("contactNumber").notNull(),
  department: text("department").notNull(),
  role: text("role").notNull().default("user"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Add new company branding table after the existing tables
export const companyBranding = pgTable("company_branding", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull(),
  headerStyle: text("header_style").notNull().default("modern"),
  primaryColor: text("primary_color").notNull().default("#71569E"),
  secondaryColor: text("secondary_color").notNull().default("#F0F0FA"),
  accentColor: text("accent_color").notNull().default("#191160"),
  logo: text("logo"), // Changed to text to store base64 encoded image
  logoMimeType: text("logo_mime_type"),
  footerText: text("footer_text"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Add vendor table here
export const vendors = pgTable("vendors", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull(),
  registrationNumber: text("registration_number").notNull(),
  contactPerson: text("contact_person").notNull(),
  contactNumber: text("contact_number").notNull(),
  email: text("email"),
  bankName: text("bank_name").notNull(),
  accountNumber: text("account_number").notNull(),
  ibanNumber: text("iban_number").notNull(),
  address: text("address").notNull(), // Added address column as required
  category: text("category").notNull(),
  paymentCurrency: text("payment_currency").notNull(),
  rating: integer("rating"),
  ratingComments: text("rating_comments"),
  status: text("status").notNull().default("active"),
  blockReason: text("block_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});


// Then define all relations after the table definitions
export const userRelations = relations(users, ({ many }) => ({
  requestsCreated: many(purchaseRequests),
  approvalsGiven: many(approvals),
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
    fields: [purchaseRequests.companyName],
    references: [vendors.companyName],
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

export const vendorRelations = relations(vendors, ({ many }) => ({
  purchaseRequests: many(purchaseRequests),
}));

// Types and schemas
export type User = InferModel<typeof users>;
export type SubPurpose = InferModel<typeof subPurposes>;
export type PurchaseRequest = InferModel<typeof purchaseRequests>;
export type Approval = InferModel<typeof approvals>;
export type FileAttachment = InferModel<typeof fileAttachments>;
export type Notification = InferModel<typeof notifications>;

// Add relation types
export type PurchaseRequestWithRelations = PurchaseRequest & {
  requester?: User;
  approvals?: Approval[];
  subPurpose?: SubPurpose;
  attachments?: FileAttachment[];
  vendor?: Vendor;
};

export type ApprovalWithRelations = Approval & {
  request?: PurchaseRequest;
  approver?: User;
};

export const mandatoryDepartments = ["CEO Office", "Finance", "Director"] as const;
export type MandatoryDepartment = typeof mandatoryDepartments[number];

// Schemas
export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const insertUserSchema = createInsertSchema(users, {
  role: z.enum(["user", "approver", "admin"]).default("user"),
  email: z.string().email("Invalid email format"),
  contactNumber: z.string().min(1, "Contact number is required"),
  department: z.string().min(1, "Department is required"),
});

export const selectUserSchema = createSelectSchema(users);
export type LoginCredentials = z.infer<typeof loginSchema>;

export const insertSubPurposeSchema = createInsertSchema(subPurposes, {
  purposeType: z.enum(["event", "project", "mall", "business_growth"]),
  isFrozen: z.boolean().optional(),
  validFrom: z.string().datetime().optional(),
  validTo: z.string().datetime().optional(),
});

export const selectSubPurposeSchema = createSelectSchema(subPurposes);

export const insertPurchaseRequestSchema = createInsertSchema(purchaseRequests, {
  purposeType: z.enum(["event", "project", "mall", "business_growth"]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  currency: z.enum(["QAR", "USD", "CNY"]),
  totalEstimatedCost: z.string().transform((val) => Number(val)),
  freightAmount: z.string().transform((val) => Number(val)),
  items: z.array(z.object({
    name: z.string().min(1, "Item name is required"),
    quantity: z.number().int().positive("Quantity must be a positive number"),
    estimatedCost: z.number().min(0, "Cost must be non-negative"),
    description: z.string().optional() // Added optional description field
  })).min(1, "At least one item is required"),
  companyName: z.string().min(1, "Company name is required"),
  contactPerson: z.string().min(1, "Contact person is required"),
  contactNumber: z.string().min(1, "Contact number is required"),
  accountNumber: z.string().min(1, "Account number is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  purpose: z.string().default(""),
  status: z.enum(["draft", "pending", "approved", "rejected", "changes_requested"]).optional(),
  isLocked: z.boolean().optional(),
  mandatoryApproversCount: z.number().optional(),
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

export const insertAccountRequestSchema = createInsertSchema(accountRequests, {
  role: z.enum(["user", "approver", "admin"]).default("user"),
  email: z.string().email("Invalid email format"),
  contactNumber: z.string().min(1, "Contact number is required"),
  department: z.string().min(1, "Department is required"),
  status: z.enum(["pending", "approved", "rejected"]).default("pending"),
});

export const selectAccountRequestSchema = createSelectSchema(accountRequests);
export type AccountRequest = InferModel<typeof accountRequests>;
export type NewAccountRequest = InferModel<typeof accountRequests>;

// Add notification schemas
export const insertNotificationSchema = createInsertSchema(notifications);
export const selectNotificationSchema = createSelectSchema(notifications);
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

export const insertVendorSchema = createInsertSchema(vendors, {
  category: z.enum(["materials_supplier", "service_provider", "logistic_partner", "equipment_rental", "others"]),
  paymentCurrency: z.enum(["USD", "QAR", "EUR", "CNY"]),
  rating: z.number().min(1).max(5).optional(),
  status: z.enum(["active", "blocked"]).default("active"),
  email: z.string().email("Invalid email format").optional(),
  blockReason: z.string().optional(),
});

export const selectVendorSchema = createSelectSchema(vendors);
export type Vendor = typeof vendors.$inferSelect;
export type NewVendor = typeof vendors.$inferInsert;

export type CompanyBranding = typeof companyBranding.$inferSelect;
export type NewCompanyBranding = typeof companyBranding.$inferInsert;

export const insertCompanyBrandingSchema = createInsertSchema(companyBranding, {
  headerStyle: z.enum(["modern", "classic", "minimal"]),
  primaryColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid hex color"),
  secondaryColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid hex color"),
  accentColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid hex color"),
  logo: z.string().optional(),
  logoMimeType: z.string().optional(),
  footerText: z.string().optional(),
});

export const selectCompanyBrandingSchema = createSelectSchema(companyBranding);