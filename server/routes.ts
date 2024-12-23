import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { db } from "@db";
import { purchaseRequests, approvals, users, subPurposes } from "@db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { format, startOfDay, endOfDay } from "date-fns";

async function generateRequestNumber(purposeType: string, subPurposeId: number | undefined): Promise<string> {
  // Get today's date in YYYYMMDD format
  const today = new Date();
  const dateStr = format(today, "yyyyMMdd");

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

  // Get the current sequence number for today using a date range
  const existingRequests = await db.select()
    .from(purchaseRequests)
    .where(
      and(
        sql`DATE(${purchaseRequests.createdAt}) = DATE(${today})`
      )
    );

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
    try {
      const purposes = await db.select()
        .from(subPurposes)
        .where(purposeType ? eq(subPurposes.purposeType, purposeType) : undefined);

      res.json(purposes);
    } catch (error: any) {
      console.error("Error fetching sub-purposes:", error);
      res.status(500).send(error.message);
    }
  });

  app.post("/api/sub-purposes", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const purpose = await db.insert(subPurposes)
        .values(req.body)
        .returning();

      res.json(purpose[0]);
    } catch (error: any) {
      console.error("Error creating sub-purpose:", error);
      res.status(500).send(error.message);
    }
  });

  // Purchase request routes
  app.post("/api/requests", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const requestNumber = await generateRequestNumber(req.body.purposeType, req.body.subPurposeId);
      console.log("Generated request number:", requestNumber);

      const request = await db.insert(purchaseRequests)
        .values({
          ...req.body,
          requestNumber,
          requesterId: req.user!.id,
          status: req.body.status || "draft"
        })
        .returning();

      res.json(request[0]);
    } catch (error: any) {
      console.error("Error creating request:", error);
      res.status(500).send(error.message);
    }
  });

  app.get("/api/requests", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
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
    } catch (error: any) {
      console.error("Error fetching requests:", error);
      res.status(500).send(error.message);
    }
  });

  app.put("/api/requests/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const request = await db
        .update(purchaseRequests)
        .set(req.body)
        .where(eq(purchaseRequests.id, parseInt(req.params.id)))
        .returning();

      res.json(request[0]);
    } catch (error: any) {
      console.error("Error updating request:", error);
      res.status(500).send(error.message);
    }
  });

  // Approval routes
  app.post("/api/approvals", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const approval = await db.insert(approvals).values({
        ...req.body,
        approverId: req.user!.id,
        department: req.user!.department
      }).returning();

      res.json(approval[0]);
    } catch (error: any) {
      console.error("Error creating approval:", error);
      res.status(500).send(error.message);
    }
  });

  app.put("/api/approvals/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const approval = await db
        .update(approvals)
        .set(req.body)
        .where(eq(approvals.id, parseInt(req.params.id)))
        .returning();

      res.json(approval[0]);
    } catch (error: any) {
      console.error("Error updating approval:", error);
      res.status(500).send(error.message);
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}