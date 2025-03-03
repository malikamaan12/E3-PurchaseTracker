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
    comments: z.string().optional(),
    processedAt: z.string().optional(),
    approver: z.object({
      username: z.string()
    }).optional()
  })).optional(),
  currency: z.string().optional(),
  freightAmount: z.number().optional(),
  subPurpose: z.object({
    name: z.string()
  }).optional(),
  vendor: z.object({
    name: z.string().optional(),
    companyName: z.string().optional(),
    contactPerson: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    contactNumber: z.string().optional()
  }).optional(),
  attachments: z.array(z.object({
    id: z.number(),
    fileName: z.string(),
    fileType: z.string(),
    fileSize: z.number(),
    fileUrl: z.string()
  })).optional()
});

export type RequestData = z.infer<typeof requestSchema>;

// Extended interface for PDF generation
export interface PurchaseRequestWithRelations {
  id: number;
  requesterId: number;
  title: string;
  description: string;
  requestNumber: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt?: string;
  processedAt?: string;
  purposeType: string;
  currency?: string;
  freightAmount?: number;
  totalEstimatedCost?: number;
  items: Array<{
    name: string;
    quantity: number;
    estimatedCost: number;
    description?: string;
  }>;
  requester?: {
    id: number;
    username: string;
    department?: string;
  };
  approvals?: Array<{
    id: number;
    status: string;
    department: string;
    comments?: string;
    processedAt?: string;
    approver?: {
      username: string;
    };
  }>;
  subPurpose?: {
    name: string;
  };
  vendor?: {
    name?: string;
    companyName?: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    contactNumber?: string;
  };
  attachments?: Array<{
    id: number;
    fileName: string;
    fileType: string;
    fileSize: number;
    fileUrl: string;
  }>;
}
