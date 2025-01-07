import { Request as ExpressRequest } from 'express';

export interface Request {
  id: number;
  requestNumber: string;
  requesterId: number;
  title: string;
  description: string;
  status: string;
  items: string; // JSON string of items
  totalEstimatedCost: number;
  createdAt: string;
  updatedAt: string;
  purposeType: string;
  priority: string;
  isLocked: boolean;
  vendorId: number;
  subPurposeId: number;
  requester?: {
    id: number;
    username: string;
    email: string;
    department: string;
    role: string;
    contact_number: string;
  };
}

declare global {
  namespace Express {
    interface Request extends ExpressRequest {
      id: string;
    }
  }
}