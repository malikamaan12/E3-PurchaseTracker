import { Request } from 'express';
import { db } from '@db';
import { auditLogs, type AuditAction } from '@db/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

export interface AuditLogEntry {
  userId: number;
  action: AuditAction;
  resourceId?: number;
  resourceType?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export async function logAuditEvent(req: Request, entry: Omit<AuditLogEntry, 'ipAddress' | 'userAgent'>) {
  try {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('user-agent');

    await db.insert(auditLogs).values({
      ...entry,
      ipAddress,
      userAgent,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
}

export async function getAuditLogs(filters: {
  userId?: number;
  action?: AuditAction;
  resourceId?: number;
  startDate?: Date;
  endDate?: Date;
}) {
  const whereConditions = [];

  // Collect filters
  if (filters.userId) {
    whereConditions.push(eq(auditLogs.userId, filters.userId));
  }
  if (filters.action) {
    whereConditions.push(eq(auditLogs.action, filters.action));
  }
  if (filters.resourceId) {
    whereConditions.push(eq(auditLogs.resourceId, filters.resourceId));
  }
  if (filters.startDate && filters.endDate) {
    whereConditions.push(
      and(
        gte(auditLogs.timestamp, filters.startDate),
        lte(auditLogs.timestamp, filters.endDate)
      )
    );
  }

  // Build and execute query in one chain to preserve Drizzle types
  return db
    .select()
    .from(auditLogs)
    .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
    .orderBy(desc(auditLogs.timestamp));
}