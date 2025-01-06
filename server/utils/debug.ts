import type { Request } from "express";
import { db } from "@db";
import { notifications } from "@db/schema";

export const debug = (req: Request, message: string, data?: any) => {
  console.log(`[${req.method} ${req.path}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
};

export const createNotification = async (userId: number, title: string, message: string, type: string, linkId?: number) => {
  return await db.insert(notifications).values({
    userId,
    title,
    message,
    type,
    link: linkId ? `/requests/${linkId}` : undefined,
    createdAt: new Date(),
    isRead: false
  }).returning();
};
