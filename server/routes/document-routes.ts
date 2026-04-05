import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { db } from "@db";
import { 
  purchaseRequests, 
  pdfSettings, 
  fileAttachments, 
  auditLogs,
  users,
  vendors,
  subPurposes,
  approvals,
  systemSettings
} from "@db/schema";
import { eq, and, desc, inArray, gte, lte } from "drizzle-orm";
import { AppError, ValidationError, DatabaseError } from "../utils/errors";
import { debug } from "../utils/debug";
import { canUserApprove } from "../utils/auth";
import { logAuditEvent } from "../utils/audit-logger";
import { getContentType, getContentDisposition } from "../utils/file-utils";
import { isR2Configured, r2Storage } from "../services/R2StorageService";
import path from "path";
import fs from "fs";
import * as XLSX from "xlsx";
import { format } from "date-fns";

const router = Router();

// Optimized helper to fetch request with ALL relations in a SINGLE round-trip
async function getFullRequestData(requestId: number) {
  // Use Drizzle's relational query API to pull all dependencies at once
  // This is critical for Vercel Serverless to stay under the 10s execution limit
  const request = await db.query.purchaseRequests.findFirst({
    where: (pr: any, { eq }: any) => eq(pr.id, requestId),
    with: {
      requester: true,
      vendor: true,
      subPurpose: true,
      attachments: true,
      approvals: {
        with: {
          approver: {
            columns: {
              username: true
            }
          }
        }
      }
    }
  });

  return request;
}

// --- PDF Routes ---

router.get("/requests/:id/pdf", async (req, res, next) => {
  try {
    if (!req.isAuthenticated()) throw new AppError("Not authenticated", 401);

    const requestId = parseInt(req.params.id);
    const { preview = false } = req.query;
    const isPreview = preview === "true";

    const requestData = await getFullRequestData(requestId);
    if (!requestData) throw new AppError("Request not found", 404);

    // Permission check
    const canView = req.user!.role === "admin" || 
                    requestData.requesterId === req.user!.id || 
                    (await canUserApprove(req.user!.id, requestId));

    if (!canView && !isPreview) throw new AppError("Unauthorized", 403);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PHASE 7: PDF BRANDED SETTINGS & SYSTEM COLORS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const [settings] = await db.select().from(pdfSettings).limit(1);
    const systemSettingsRecords = await db.select().from(systemSettings);
    
    // Helper to extract nested JSON values or strings from system settings
    const getSetting = (key: string, defaultValue: any) => {
      const record = systemSettingsRecords.find(r => r.key === key);
      return record ? (record.value as any) : defaultValue;
    };

    // Extract dynamic brand colors
    const primaryHex = getSetting("brand_primary_color", settings?.headerColor || "#6F2AE6");
    const secondaryHex = getSetting("brand_secondary_color", settings?.footerColor || "#15CDD8");
    const companyNameValue = getSetting("company_name", "E3 ASSET MANAGEMENT");

    // Helper to convert hex to pdf-lib RGB (0-1)
    const hexToRgb = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      return { r, g, b };
    };

    const primaryColor = hexToRgb(primaryHex);
    const secondaryColor = hexToRgb(secondaryHex);

    // Audit Log
    if (!isPreview) {
      await logAuditEvent(req, {
        userId: req.user!.id,
        action: "pdf_downloaded",
        resourceId: requestId,
        resourceType: "purchase_request",
        details: { reportType: "consolidated" },
      });
    }

    try {
      const generationStartTime = Date.now();
      const { PDFDocument, rgb, StandardFonts, degrees } = await import("pdf-lib");
      const pdfDoc = await PDFDocument.create();
      
      // Dynamic Colors
      const brandPurple = rgb(primaryColor.r, primaryColor.g, primaryColor.b);
      const brandTeal = rgb(secondaryColor.r, secondaryColor.g, secondaryColor.b);
      const neutralGrey = rgb(0.4, 0.4, 0.4);
      
      const page = pdfDoc.addPage([595.28, 841.89]);
      const { width, height } = page.getSize();
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
      
      // --- Watermark ---
      const watermarkText = settings?.watermarkText || "CONFIDENTIAL";
      page.drawText(watermarkText, {
        x: 100,
        y: height / 2 - 100,
        size: 60,
        font: fontBold,
        color: rgb(0.95, 0.95, 0.95),
        rotate: degrees(45),
        opacity: (settings?.watermarkOpacity || 10) / 100,
      });

      let y = height - 60;
      
      // Header Bar
      page.drawRectangle({
        x: 0,
        y: height - 80,
        width: width,
        height: 80,
        color: brandPurple,
      });

      page.drawText(settings?.headerTitle || 'PURCHASE REQUEST', { 
        x: 50, 
        y: height - 50, 
        size: 24, 
        font: fontBold, 
        color: rgb(1, 1, 1) 
      });

      if (settings?.headerSubtitle) {
        page.drawText(settings.headerSubtitle, {
          x: 50,
          y: height - 68,
          size: 10,
          font: fontRegular,
          color: rgb(0.9, 0.9, 0.9)
        });
      }

      y = height - 120;
      
      // Infrastructure Details
      page.drawText(`Request ID: ${requestData.requestNumber}`, { x: 50, y, size: 12, font: fontBold, color: brandPurple });
      page.drawText(`Date: ${format(new Date(requestData.createdAt || ""), "PPP")}`, { x: width - 200, y, size: 10, font: fontRegular });
      
      y -= 30;
      page.drawText(`Title: ${requestData.title}`, { x: 50, y, size: 16, font: fontBold });
      
      y -= 40;
      page.drawRectangle({ x: 50, y, width: width - 100, height: 1, color: rgb(0.9, 0.9, 0.9) });
      
      // Items Table Header
      y -= 30;
      page.drawText("ITEM DESCRIPTION", { x: 50, y, size: 10, font: fontBold, color: neutralGrey });
      page.drawText("QTY", { x: 350, y, size: 10, font: fontBold, color: neutralGrey });
      page.drawText("UNIT COST", { x: 420, y, size: 10, font: fontBold, color: neutralGrey });
      page.drawText("TOTAL", { x: 500, y, size: 10, font: fontBold, color: neutralGrey });
      
      y -= 15;
      const itemsToPrint = typeof requestData.items === 'string' ? JSON.parse(requestData.items) : (requestData.items || []);
      
      itemsToPrint.forEach((item: any, idx: number) => {
        if (idx % 2 === 0) {
          page.drawRectangle({ x: 45, y: y - 5, width: width - 90, height: 20, color: rgb(0.98, 0.98, 1) });
        }
        page.drawText(item.name.substring(0, 45), { x: 50, y, size: 9, font: fontRegular });
        page.drawText(item.quantity.toString(), { x: 350, y, size: 9, font: fontRegular });
        page.drawText(item.estimatedCost.toLocaleString(), { x: 420, y, size: 9, font: fontRegular });
        page.drawText((item.quantity * item.estimatedCost).toLocaleString(), { x: 500, y, size: 9, font: fontBold });
        y -= 20;
      });

      // Summary
      y -= 40;
      page.drawRectangle({ x: 350, y, width: 200, height: 50, color: rgb(0.97, 0.97, 0.97) });
      page.drawText("TOTAL ESTIMATED COST", { x: 360, y: y + 30, size: 8, font: fontBold, color: neutralGrey });
      page.drawText(`${requestData.totalEstimatedCost.toLocaleString()} QAR`, { 
        x: 360, 
        y: y + 10, 
        size: 16, 
        font: fontBold, 
        color: brandPurple 
      });

      // Branding Footer
      page.drawText("Generated via PurchaseTracker Enterprise • E3 Asset Management", {
        x: width / 2 - 150,
        y: 30,
        size: 8,
        font: fontRegular,
        color: brandTeal
      });

      const pdfBytes = await pdfDoc.save();
      
      const generationDuration = Date.now() - generationStartTime;
      if (generationDuration > 8000) {
          console.warn(`[WARNING - VERCEL RESTRICTION] PDF Generation took ${generationDuration}ms for Request ${requestId}, dangerously close to the 10-second serverless execution timeout limit.`);
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="request-${requestId}.pdf"`);
      return res.send(Buffer.from(pdfBytes));
    } catch (pdfErr) {
      debug(req, "PDF lib generation failed, falling back to JSON", pdfErr);
      return res.json({ success: true, data: requestData, pdfSettings: settings, error: pdfErr?.toString() });
    }
  } catch (error) {
    next(error);
  }
});

// --- Export Routes ---

router.get("/requests/export", async (req, res, next) => {
  try {
    if (!req.isAuthenticated() || req.user!.role === 'user') throw new AppError("Unauthorized", 403);

    const { format = 'excel' } = req.query;
    
    // Fetch all requests with filters (simplified for export)
    const requests = await db
      .select({
        requestNumber: purchaseRequests.requestNumber,
        title: purchaseRequests.title,
        status: purchaseRequests.status,
        totalCost: purchaseRequests.totalEstimatedCost,
        createdAt: purchaseRequests.createdAt,
        requester: users.username,
        department: users.department
      })
      .from(purchaseRequests)
      .innerJoin(users, eq(users.id, purchaseRequests.requesterId))
      .orderBy(desc(purchaseRequests.createdAt));

    if (format === 'csv') {
      const { Parser } = await import("@json2csv/plainjs");
      const parser = new Parser();
      const csv = parser.parse(requests);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="requests.csv"');
      return res.send(csv);
    }

    // Excel Export
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(requests);
    XLSX.utils.book_append_sheet(wb, ws, "Requests");
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="requests.xlsx"');
    res.send(buf);
  } catch (error) {
    next(error);
  }
});

router.get("/requests/:id/zip", async (req, res, next) => {
  try {
    if (!req.isAuthenticated()) throw new AppError("Not authenticated", 401);
    const requestId = parseInt(req.params.id);
    
    const requestData = await getFullRequestData(requestId);
    if (!requestData) throw new AppError("Not found", 404);

    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    // Add JSON data
    zip.file("request_details.json", JSON.stringify(requestData, null, 2));

    // Add attachments if any
    if (requestData.attachments && requestData.attachments.length > 0) {
      const folder = zip.folder("attachments");
      for (const att of requestData.attachments) {
        if (att.fileUrl.startsWith('r2://')) {
          if (isR2Configured) {
            const objectKey = att.fileUrl.replace('r2://', '');
            try {
              // Get presigned URL and fetch the file into buffer
              const signedUrl = await r2Storage.getReadPresignedUrl(objectKey);
              const response = await fetch(signedUrl);
              const arrayBuffer = await response.arrayBuffer();
              folder?.file(att.fileName, Buffer.from(arrayBuffer));
            } catch (err) {
              console.error(`Failed to fetch R2 attachment ${att.fileName} for ZIP:`, err);
            }
          }
        } else {
          const filePath = path.join(process.cwd(), att.fileUrl);
          if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath);
            folder?.file(att.fileName, content);
          }
        }
      }
    }

    const content = await zip.generateAsync({ type: "nodebuffer" });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="request-${requestId}.zip"`);
    res.send(content);
  } catch (error) {
    next(error);
  }
});

export default router;
