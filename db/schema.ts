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
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type LoginCredentials = z.infer<typeof loginSchema>;

export const subPurposes = pgTable("sub_purposes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  purposeType: text("purpose_type").notNull(),
  isFrozen: boolean("is_frozen").notNull().default(false),
  validFrom: timestamp("valid_from"),
  validTo: timestamp("valid_to"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSubPurposeSchema = createInsertSchema(subPurposes, {
  purposeType: z.enum(["event", "project", "mall", "business_growth"]),
  isFrozen: z.boolean().optional(),
  validFrom: z.string().datetime().optional(),
  validTo: z.string().datetime().optional(),
});

export const selectSubPurposeSchema = createSelectSchema(subPurposes);
export type SubPurpose = typeof subPurposes.$inferSelect;
export type NewSubPurpose = typeof subPurposes.$inferInsert;

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

export const fileAttachmentRelations = relations(fileAttachments, ({ one }) => ({
  request: one(purchaseRequests, {
    fields: [fileAttachments.requestId],
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

export const mandatoryDepartments = ["CEO Office", "Finance", "Director"] as const;

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

export type PurchaseRequest = z.infer<typeof selectPurchaseRequestSchema> & {
  approvals: Array<z.infer<typeof selectApprovalSchema> & { approver: User }>;
  subPurpose: z.infer<typeof selectSubPurposeSchema> | null;
  requester: User;
  attachments?: Array<FileAttachment>;
};

export type NewPurchaseRequest = typeof purchaseRequests.$inferInsert;

export const insertApprovalSchema = createInsertSchema(approvals);
export const selectApprovalSchema = createSelectSchema(approvals);
export type Approval = typeof approvals.$inferSelect;
export type NewApproval = typeof approvals.$inferInsert;

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  requestId: integer("request_id").references(() => purchaseRequests.id),
  message: text("message").notNull(),
  type: text("type").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

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

export const insertNotificationSchema = createInsertSchema(notifications);
export const selectNotificationSchema = createSelectSchema(notifications);
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

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

export const insertAccountRequestSchema = createInsertSchema(accountRequests, {
  role: z.enum(["user", "approver", "admin"]).default("user"),
  email: z.string().email("Invalid email format"),
  contactNumber: z.string().min(1, "Contact number is required"),
  department: z.string().min(1, "Department is required"),
  status: z.enum(["pending", "approved", "rejected"]).default("pending"),
});

export const selectAccountRequestSchema = createSelectSchema(accountRequests);
export type AccountRequest = typeof accountRequests.$inferSelect;
export type NewAccountRequest = typeof accountRequests.$inferInsert;

export const insertFileAttachmentSchema = createInsertSchema(fileAttachments);
export const selectFileAttachmentSchema = createSelectSchema(fileAttachments);
export type FileAttachment = typeof fileAttachments.$inferSelect;
export type NewFileAttachment = typeof fileAttachments.$inferInsert;