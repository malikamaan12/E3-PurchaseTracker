import { pgTable, text, serial, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
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

export const purchaseRequests = pgTable("purchase_requests", {
  id: serial("id").primaryKey(),
  requesterId: integer("requester_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  items: json("items").$type<Array<{
    name: string;
    quantity: number;
    estimatedCost: number;
  }>>().notNull(),
  vendor: text("vendor").notNull(),
  purpose: text("purpose").notNull(),
  purposeType: text("purpose_type").notNull(),
  totalEstimatedCost: integer("total_estimated_cost").notNull(),
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
  approvals: many(approvals),
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

export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export const insertPurchaseRequestSchema = createInsertSchema(purchaseRequests, {
  purposeType: z.enum(["event", "project", "mall", "business_growth"])
});
export const selectPurchaseRequestSchema = createSelectSchema(purchaseRequests);
export type PurchaseRequest = typeof purchaseRequests.$inferSelect;
export type NewPurchaseRequest = typeof purchaseRequests.$inferInsert;

export const insertApprovalSchema = createInsertSchema(approvals);
export const selectApprovalSchema = createSelectSchema(approvals);
export type Approval = typeof approvals.$inferSelect;
export type NewApproval = typeof approvals.$inferInsert;