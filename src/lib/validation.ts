import { z } from "zod";

/**
 * Institutional Validation Layer
 * Standardized Zod schemas for PurchaseTracker API hardening.
 */

export const itemSchema = z.object({
  name: z.string().min(1, "Item name is required"),
  quantity: z.number().positive("Quantity must be positive"),
  estimatedCost: z.number().min(0, "Cost cannot be negative"),
  description: z.string().optional(),
});

export const installmentSchema = z.object({
  installmentName: z.string().min(1, "Installment name is required"),
  dueDate: z.string().or(z.date()),
  valueType: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
  amountValue: z.number().positive("Amount/Percentage must be positive"),
});

export const createRequestSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  totalEstimatedCost: z.number().min(0),
  vendorId: z.number().int().positive(),
  purposeType: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  currency: z.string().default("QAR"),
  freightAmount: z.number().min(0).optional(),
  subPurposeId: z.number().int().positive().nullable().optional(),
  purposeCategoryId: z.number().int().positive().nullable().optional(),
  items: z.array(itemSchema).min(1, "At least one item is required"),
  attachmentIds: z.array(z.number()).optional(),
  paymentStructure: z.enum(["ADVANCE", "IN_PARTS", "POST_PROJECT"]),
  installments: z.array(installmentSchema).optional(),
  status: z.enum(["draft", "pending"]).default("draft"),
});

export const updateRequestSchema = createRequestSchema.partial().extend({
  revisedTotalCost: z.number().min(0).optional(),
});

export const vendorSchema = z.object({
  companyName: z.string().min(2),
  contactPerson: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  category: z.string().optional(),
  complianceScore: z.number().min(0).max(100).optional(),
});
