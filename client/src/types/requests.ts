import { z } from "zod";

export const requestSchema = z.object({
  id: z.number(),
  requesterId: z.number(),
  status: z.string(),
  title: z.string(),
  description: z.string(),
  requestNumber: z.string(),
  createdAt: z.string(),
  priority: z.string(),
  purposeType: z.string(),
  totalEstimatedCost: z.number(),
  items: z.array(z.object({
    name: z.string(),
    quantity: z.number(),
    estimatedCost: z.number(),
    description: z.string().optional()
  })),
  requester: z.object({
    id: z.number(),
    username: z.string(),
    email: z.string().optional(),
    department: z.string().optional(),
    role: z.string().optional()
  }).optional(),
  approvals: z.array(z.object({
    id: z.number(),
    status: z.string(),
    department: z.string(),
    comments: z.string().optional()
  })).optional()
});

export type RequestData = z.infer<typeof requestSchema>;
