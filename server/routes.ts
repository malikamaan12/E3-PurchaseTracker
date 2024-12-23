import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { db } from "@db";
import { purchaseRequests, approvals, users, subPurposes } from "@db/schema";
import { eq, and, desc } from "drizzle-orm";
import { format } from "date-fns";

async function generateRequestNumber(purposeType: string, subPurposeId: number | undefined): Promise<string> {
  // Get today's date in YYYYMMDD format
  const dateStr = format(new Date(), "yyyyMMdd");

  // Get the sub-purpose code (first 3 letters) or use purpose type if no sub-purpose
  let purposeCode = purposeType.substring(0, 3).toUpperCase();
  if (subPurposeId) {
    const [subPurpose] = await db.select()
      .from(subPurposes)
      .where(eq(subPurposes.id, subPurposeId))
      .limit(1);
    if (subPurpose) {
      purposeCode = subPurpose.name.substring(0, 3).toUpperCase();
    }
  }

  // Get the current sequence number for today
  const existingRequests = await db.select()
    .from(purchaseRequests)
    .where(eq(purchaseRequests.createdAt, new Date(dateStr)));

  const sequenceNumber = (existingRequests.length + 1).toString().padStart(3, '0');

  return `${purposeCode}/${dateStr}/${sequenceNumber}`;
}

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // Sub-purposes routes
  app.get("/api/sub-purposes", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const purposeType = req.query.purposeType as string;
    const purposes = await db.select()
      .from(subPurposes)
      .where(purposeType ? eq(subPurposes.purposeType, purposeType) : undefined);

    res.json(purposes);
  });

  app.post("/api/sub-purposes", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const purpose = await db.insert(subPurposes)
      .values(req.body)
      .returning();

    res.json(purpose[0]);
  });

  // Purchase request routes
  app.post("/api/requests", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const requestNumber = await generateRequestNumber(req.body.purposeType, req.body.subPurposeId);

    const request = await db.insert(purchaseRequests).values({
      ...req.body,
      requestNumber,
      requesterId: req.user!.id,
      status: req.body.status || "draft"
    }).returning();

    res.json(request[0]);
  });

  app.get("/api/requests", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const requests = await db.query.purchaseRequests.findMany({
      with: {
        requester: true,
        approvals: {
          with: {
            approver: true
          }
        },
        subPurpose: true
      },
      orderBy: desc(purchaseRequests.createdAt)
    });

    res.json(requests);
  });

  app.put("/api/requests/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const request = await db
      .update(purchaseRequests)
      .set(req.body)
      .where(eq(purchaseRequests.id, parseInt(req.params.id)))
      .returning();

    res.json(request[0]);
  });

  // Approval routes
  app.post("/api/approvals", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const approval = await db.insert(approvals).values({
      ...req.body,
      approverId: req.user!.id,
      department: req.user!.department
    }).returning();

    res.json(approval[0]);
  });

  app.put("/api/approvals/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const approval = await db
      .update(approvals)
      .set(req.body)
      .where(eq(approvals.id, parseInt(req.params.id)))
      .returning();

    res.json(approval[0]);
  });

  const httpServer = createServer(app);
  return httpServer;
}