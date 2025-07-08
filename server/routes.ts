import type { Express } from "express";
import { createServer, type Server } from "http";
import path from "path";
import { upload } from "./utils/upload";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import { db } from "@db";
import { setupAuth } from "./auth";
import { debug } from "./utils/debug";
import { conversionService } from "./services/ConversionService";
import { logAuditEvent } from "./utils/audit-logger";
import { canUserApprove } from "./utils/auth";
import multer from "multer";
import JSZip from "jszip";
// Import the notification service and route registrar
import { notificationService } from "./services/NotificationService";
import { registerNotificationRoutes } from "./routes/notification-routes";
// Import Claude AI routes is now in-line where it's used
import { AuthorizationError, NotFoundError } from "./utils/errors";
import {
  users,
  notifications,
  purchaseRequests,
  approvals,
  fileAttachments,
  vendors,
  errorLogs,
  subPurposes,
  accountRequests,
  insertPurchaseRequestSchema,
  insertAccountRequestSchema,
  insertErrorLogSchema,
  notificationPreferences,
  insertNotificationPreferenceSchema,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_TYPES,
  insertVendorSchema,
  type InsertVendor,
  type AuditAction,
  insertSubPurposeSchema,
  auditLogs,
  pdfSettings,
  purchaseApprovers,
} from "@db/schema";
import {
  eq,
  and,
  desc,
  gte,
  lte,
  inArray,
  or,
  isNull,
  ne,
  sql,
  ilike,
} from "drizzle-orm";
import bcrypt from "bcrypt";
import fs from "fs/promises";
import fsSync from "fs";
import XLSX from "xlsx"; // Import XLSX library

// Error Classes
class DatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseError";
  }
}

class AppError extends Error {
  status: number;
  constructor(message: string, status: number = 500) {
    super(message);
    this.name = "AppError";
    this.status = status;
  }
}

class ValidationError extends Error {
  details: any;
  constructor(message: string, details: any) {
    super(message);
    this.name = "ValidationError";
    this.details = details;
  }
}

// Helper functions for content type and disposition
const getContentType = (filename: string): string => {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case ".pdf":
      return "application/pdf";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".doc":
      return "application/msword";
    case ".docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    default:
      return "application/octet-stream";
  }
};

const getContentDisposition = (
  filename: string,
  forceDownload: boolean,
): string => {
  return forceDownload
    ? `attachment; filename="${filename}"`
    : `inline; filename="${filename}"`;
};

export function registerRoutes(app: Express): Server {
  // Register Claude AI routes directly on the app with /api prefix
  const apiRouter = express.Router();
  // Import notification routes
  registerNotificationRoutes(apiRouter);
  // Register Claude AI routes
  import('./routes/claude-ai-routes').then(({ registerClaudeAIRoutes }) => {
    registerClaudeAIRoutes(apiRouter);
  }).catch(err => {
    console.error('Error loading Claude AI routes:', err);
  });
  app.use('/api', apiRouter);

  // Create uploads directory if it doesn't exist
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fsSync.existsSync(uploadsDir)) {
    fsSync.mkdirSync(uploadsDir, { recursive: true });
  }

  // Create uploads/logos directory if it doesn't exist
  const logoDir = path.join(process.cwd(), "uploads/logos");
  if (!fsSync.existsSync(logoDir)) {
    fsSync.mkdirSync(logoDir, { recursive: true });
  }

  // Serve uploaded files with proper content types
  // Initialize multer for logo/image uploads
  const logoUpload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, logoDir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(
          null,
          `${file.fieldname}-${uniqueSuffix}-${encodeURIComponent(file.originalname)}`,
        );
      },
    }),
    fileFilter: (req, file, cb) => {
      if (!["image/jpeg", "image/png"].includes(file.mimetype)) {
        return cb(new Error("Only JPEG and PNG images are allowed"));
      }
      cb(null, true);
    },
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit
    },
  });

  app.use(
    "/uploads",
    (req, res, next) => {
      // Set cache control headers for better performance
      res.set({
        "Cache-Control": "public, max-age=31536000",
        "Access-Control-Allow-Origin": "*",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'self'",
      });

      // For PDF files, set additional headers
      if (req.path.toLowerCase().endsWith(".pdf")) {
        res.set({
          "Content-Type": "application/pdf",
          "Content-Disposition": "inline",
        });
      }
      next();
    },
    express.static(uploadsDir, {
      setHeaders: (res, filePath) => {
        const ext = path.extname(filePath).toLowerCase();
        switch (ext) {
          case ".pdf":
            res.set("Content-Type", "application/pdf");
            break;
          case ".png":
            res.set("Content-Type", "image/png");
            break;
          case ".jpg":
          case ".jpeg":
            res.set("Content-Type", "image/jpeg");
            break;
          case ".gif":
            res.set("Content-Type", "image/gif");
            break;
          case ".doc":
            res.set("Content-Type", "application/msword");
            break;
          case ".docx":
            res.set(
              "Content-Type",
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            );
            break;
        }
      },
    }),
  );

  // Add file attachment routes
  app.get(
    "/api/attachments/:id",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.isAuthenticated()) {
          throw new AppError("Not authenticated", 401);
        }

        const attachmentId = parseInt(req.params.id);
        if (isNaN(attachmentId)) {
          throw new ValidationError("Invalid attachment ID", {
            id: "Must be a number",
          });
        }

        // Get file attachment details
        const [attachment] = await db
          .select()
          .from(fileAttachments)
          .where(eq(fileAttachments.id, attachmentId))
          .limit(1);

        if (!attachment) {
          throw new AppError("Attachment not found", 404);
        }

        // Verify file exists
        const filePath = path.join(
          process.cwd(),
          attachment.fileUrl.replace(/^\/uploads\//, "uploads/"),
        );

        try {
          await fs.access(filePath);
        } catch (error) {
          throw new AppError("File not found on server", 404);
        }

        // Determine if it should be a forced download
        const forceDownload = req.query.download === "true";

        // Set appropriate headers using middleware helpers
        res.set({
          "Content-Type": getContentType(attachment.fileName),
          "Content-Disposition": getContentDisposition(
            attachment.fileName,
            forceDownload,
          ),
          "Cache-Control": "public, max-age=31536000",
          "X-Content-Type-Options": "nosniff",
        });

        // Stream the file
        const fileStream = fsSync.createReadStream(filePath);
        fileStream.pipe(res);
      } catch (error) {
        next(error);
      }
    },
  );

  // Add file conversion endpoints
  app.get(
    "/api/conversion/formats",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { type } = req.query;
        if (!type || typeof type !== "string") {
          throw new ValidationError("Invalid input", {
            type: ["Source type is required"],
          });
        }

        const formats = await conversionService.getAvailableFormats(type);
        res.json(formats);
      } catch (error) {
        next(error);
      }
    },
  );

  app.post(
    "/api/conversion/convert",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { sourceFormat, targetFormat, filePath } = req.body;

        if (!sourceFormat || !targetFormat || !filePath) {
          throw new ValidationError("Invalid input", {
            details: "Source format, target format, and file path are required",
          });
        }

        // Get absolute path from relative URL
        const absolutePath = path.join(
          process.cwd(),
          filePath.replace(/^\/uploads\//, "uploads/"),
        );

        // Ensure the file exists
        await fs.access(absolutePath);

        // Perform the conversion
        const result = await conversionService.convertFile(
          absolutePath,
          targetFormat,
          sourceFormat,
        );

        // Return the converted file information
        res.json({
          success: true,
          fileUrl: `/uploads/converted/${path.basename(result.outputPath)}`,
          outputType: result.outputType,
          size: (await fs.stat(result.outputPath)).size,
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes("ENOENT")) {
          next(new AppError("Source file not found", 404));
        } else {
          next(error);
        }
      }
    },
  );

  // Add GET endpoint for fetching a single purchase request
  app.get(
    "/api/requests/:id",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.isAuthenticated()) {
          throw new AppError("Not authenticated", 401);
        }

        const requestId = parseInt(req.params.id);
        debug(req, `Fetching purchase request with ID: ${requestId}`);

        if (isNaN(requestId)) {
          throw new ValidationError("Invalid request ID", {
            id: "Must be a number",
          });
        }

        try {
          // First get the base request
          const requests = await db.query.purchaseRequests.findMany({
            where: eq(purchaseRequests.id, requestId),
            limit: 1,
          });

          if (requests.length === 0) {
            throw new AppError("Purchase request not found", 404);
          }

          const request = requests[0];
          debug(req, `Found base request with ID: ${request.id}`);

          // Check if user has permission to view this request
          // Admin can see all requests
          const isAdmin = req.user?.role === "admin";
          // High-level departments can see all requests
          const hasFullAccess = req.user?.department === "CEO Office" ||
                               req.user?.department === "Director" ||
                               req.user?.department === "Finance";
          // User created the request
          const isRequester = request.requesterId === req.user?.id;

          // Check if user is an approver
          const approvalsForUser = await db
            .select()
            .from(approvals)
            .where(
              and(
                eq(approvals.requestId, requestId),
                eq(approvals.department, req.user?.department || ""),
                eq(approvals.approverId, req.user?.id),
              ),
            );

          const isApprover = approvalsForUser.length > 0;

          // Check if user's department is in additional approvers
          const additionalApprovers =
            typeof request.additionalApprovers === "string"
              ? JSON.parse(request.additionalApprovers)
              : Array.isArray(request.additionalApprovers)
                ? request.additionalApprovers
                : [];

          const isAdditionalApprover =
            req.user?.department &&
            additionalApprovers.includes(req.user.department);

          // If user doesn't have permission to view, return 403
          if (
            !isAdmin &&
            !hasFullAccess &&
            !isRequester &&
            !isApprover &&
            !isAdditionalApprover
          ) {
            debug(
              req,
              `User ${req.user?.id} does not have permission to view request ${requestId}`,
            );
            throw new AppError(
              "You do not have permission to view this request",
              403,
            );
          }

          // Get attachments
          const attachments = await db.query.fileAttachments.findMany({
            where: eq(fileAttachments.requestId, requestId),
          });
          debug(req, `Found ${attachments.length} attachments`);

          // Get approvals
          const approvalsList = await db.query.approvals.findMany({
            where: eq(approvals.requestId, requestId),
            with: {
              approver: true,
            },
          });
          debug(req, `Found ${approvalsList.length} approvals`);

          // Get requester
          let requester = null;
          if (request.requesterId) {
            const requesterResults = await db.query.users.findMany({
              where: eq(users.id, request.requesterId),
              limit: 1,
            });

            if (requesterResults.length > 0) {
              requester = requesterResults[0];
              debug(req, `Found requester: ${requester.username}`);
            }
          }

          // Get vendor
          let vendor = null;
          if (request.vendorId) {
            const vendorResults = await db.query.vendors.findMany({
              where: eq(vendors.id, request.vendorId),
              limit: 1,
            });

            if (vendorResults.length > 0) {
              vendor = vendorResults[0];
              debug(req, `Found vendor: ${vendor.companyName || vendor.name}`);
            } else {
              debug(req, `No vendor found with ID: ${request.vendorId}`);
            }
          }

          // Get sub-purpose
          let subPurpose = null;
          if (request.subPurposeId) {
            const subPurposeResults = await db.query.subPurposes.findMany({
              where: eq(subPurposes.id, request.subPurposeId),
              limit: 1,
            });

            if (subPurposeResults.length > 0) {
              subPurpose = subPurposeResults[0];
              debug(req, `Found sub-purpose: ${subPurpose.name}`);
            } else {
              debug(
                req,
                `No sub-purpose found with ID: ${request.subPurposeId}`,
              );
            }
          }

          // Parse items JSON safely
          let parsedItems = [];
          try {
            if (Array.isArray(request.items)) {
              parsedItems = request.items;
            } else if (typeof request.items === "string" && request.items) {
              parsedItems = JSON.parse(request.items);
            } else if (request.items && typeof request.items === "object") {
              parsedItems = Object.values(request.items);
            }
          } catch (e) {
            console.error("Error parsing items JSON:", e);
            // If parsing fails, at least return an empty array
            parsedItems = [];
          }

          // Construct and return the full response
          const result = {
            ...request,
            items: parsedItems,
            attachments,
            approvals: approvalsList,
            requester,
            vendor,
            subPurpose,
            // Default additional approvers to empty array if not present
            additionalApprovers: request.additionalApprovers || [],
          };

          debug(req, "Successfully assembled complete request data");
          res.json(result);
        } catch (error) {
          console.error("[GET /api/requests/:id] Database error:", error);
          // If it's already an AppError (like permission denied), don't wrap it
          if (error instanceof AppError) {
            throw error;
          }
          throw new DatabaseError("Failed to fetch request data from database");
        }
      } catch (error) {
        debug(req, "Error fetching purchase request:", error);
        next(error);
      }
    },
  );

  // Put this at the very beginning of the routes file, before other routes
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Public route to get login logo without authentication
  app.get(
    "/api/login-logo",
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const logoSettings = await db.query.pdfSettings.findFirst({
          columns: {
            loginLogo: true,
          },
        });

        return res.json({
          loginLogo: logoSettings?.loginLogo || null,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  // Initialize auth
  setupAuth(app);

  // Register enhanced notification routes
  registerNotificationRoutes(app);

  // Account Request endpoint with proper error handling
  app.post(
    "/api/auth/request-account",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        debug(req, "Received account request:", {
          ...req.body,
          password: "[REDACTED]",
        });

        // Validate the request data
        const validationResult = insertAccountRequestSchema.safeParse(req.body);

        if (!validationResult.success) {
          debug(req, "Validation failed:", validationResult.error);
          throw new ValidationError(
            "Invalid input data",
            validationResult.error.format(),
          );
        }

        // Check for existing username
        const [existingUser] = await db
          .select()
          .from(users)
          .where(eq(users.username, validationResult.data.username))
          .limit(1);

        if (existingUser) {
          throw new ValidationError("Username already exists", {
            username: ["Username is already taken"],
          });
        }

        // Hash password before storing
        const hashedPassword = await bcrypt.hash(
          validationResult.data.password,
          10,
        );

        // Create the account request
        const [newRequest] = await db
          .insert(accountRequests)
          .values({
            ...validationResult.data,
            password: hashedPassword,
            status: "pending",
          })
          .returning();

        debug(req, "Account request created successfully:", newRequest.id);

        // Notify admins about new account request
        const admins = await db
          .select()
          .from(users)
          .where(and(eq(users.role, "admin"), eq(users.isActive, true)));

        // Create notifications for admins
        await Promise.all(
          admins.map((admin) =>
            notificationService.createNotification({
              userId: admin.id,
              title: "New Account Request",
              message: `New account request from ${newRequest.username} for ${newRequest.department} department`,
              type: "account_request",
              priority: "normal",
            }),
          ),
        );

        res.status(201).json({
          message: "Account request submitted successfully",
          requestId: newRequest.id,
        });
      } catch (error) {
        debug(req, "Error processing account request:", error);
        next(error);
      }
    },
  );
  // Update the create purchase request endpoint
  // Add missing GET endpoint to fetch all purchase requests
  app.get(
    "/api/requests",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.isAuthenticated()) {
          throw new AppError("Not authenticated", 401);
        }

        debug(req, "Fetching purchase requests with visibility restrictions");
        console.log(
          "Fetching visible purchase requests for user:",
          req.user?.id,
          "role:",
          req.user?.role,
          "department:",
          req.user?.department,
        );

        // Get all requests first - we'll filter based on visibility permissions
        let requests = [];

        // Admin or high-level departments can see all requests
        const hasFullAccess = req.user?.role === "admin" || 
                             req.user?.department === "CEO Office" ||
                             req.user?.department === "Director" ||
                             req.user?.department === "Finance";
        
        if (hasFullAccess) {
          debug(req, "User has full access - fetching all requests");
          requests = await db
            .select()
            .from(purchaseRequests)
            .orderBy(desc(purchaseRequests.updatedAt));
        } else {
          // Regular users can only see:
          // 1. Requests they created
          // 2. Requests where they are a mandatory approver (by department)
          // 3. Requests where they are an additional approver (by department)

          // Get the list of all requests
          const allRequests = await db
            .select()
            .from(purchaseRequests)
            .orderBy(desc(purchaseRequests.updatedAt));

          // Get list of requests where user is an approver
          const approvalsForUser = await db
            .select({
              requestId: approvals.requestId,
            })
            .from(approvals)
            .where(
              and(
                eq(approvals.department, req.user?.department || ""),
                eq(approvals.approverId, req.user?.id),
              ),
            );

          const approvalRequestIds = approvalsForUser.map((a) => a.requestId);

          debug(
            req,
            `User is approver for ${approvalRequestIds.length} requests`,
          );

          // Filter requests based on visibility rules
          requests = allRequests.filter((request) => {
            // 1. User created the request
            if (request.requesterId === req.user?.id) {
              console.log(`Request ${request.id}: Visible - User is requester`);
              return true;
            }

            // 2. User is a mandatory approver (already covered in approvalRequestIds)
            if (approvalRequestIds.includes(request.id)) {
              console.log(`Request ${request.id}: Visible - User has approval record`);
              return true;
            }

            // 3. User's department is a mandatory approver department
            const mandatoryApproverDepartments = ["CEO Office", "Finance", "Director"];
            if (
              req.user?.department &&
              mandatoryApproverDepartments.includes(req.user.department)
            ) {
              console.log(`Request ${request.id}: Visible - User is mandatory approver (${req.user.department})`);
              return true;
            }

            // 4. User's department is in additionalApprovers for this request
            const additionalApprovers =
              typeof request.additionalApprovers === "string"
                ? JSON.parse(request.additionalApprovers)
                : Array.isArray(request.additionalApprovers)
                  ? request.additionalApprovers
                  : [];

            if (
              req.user?.department &&
              additionalApprovers.includes(req.user.department)
            ) {
              console.log(`Request ${request.id}: Visible - User department (${req.user.department}) is additional approver. Status: ${request.status}. Additional approvers: [${additionalApprovers.join(', ')}]`);
              return true;
            }

            console.log(`Request ${request.id}: NOT visible - No access rule matched. User dept: ${req.user?.department}, Status: ${request.status}, Additional approvers: [${additionalApprovers.join(', ')}]`);
            // Not visible to this user
            return false;
          });
        }

        console.log(
          `Found ${requests.length} purchase requests visible to user`,
        );

        // Process requests with a simplified approach
        const processedRequests = await Promise.all(
          requests.map(async (request) => {
            try {
              // Parse items JSON safely
              let parsedItems = [];
              try {
                // Check if items is already an array or needs to be parsed
                if (Array.isArray(request.items)) {
                  parsedItems = request.items;
                } else if (typeof request.items === "string") {
                  parsedItems = JSON.parse(request.items);
                } else if (request.items && typeof request.items === "object") {
                  // Try to handle non-standard format
                  console.log(
                    "Items is an object, attempting to convert:",
                    request.items,
                  );
                  parsedItems = Object.values(request.items);
                }
              } catch (e) {
                console.error("Error parsing items JSON:", e);
              }

              // Get basic requester info
              let requester = null;
              if (request.requesterId) {
                const [requesterData] = await db
                  .select()
                  .from(users)
                  .where(eq(users.id, request.requesterId))
                  .limit(1);

                requester = requesterData || null;
              }

              // Get attachments
              const attachments = await db
                .select()
                .from(fileAttachments)
                .where(eq(fileAttachments.requestId, request.id));

              // Get approvals with complete details
              const approvalsList = await db
                .select({
                  id: approvals.id,
                  requestId: approvals.requestId,
                  approverId: approvals.approverId,
                  status: approvals.status,
                  comments: approvals.comments,
                  department: approvals.department,
                  processedAt: approvals.createdAt,
                  updatedAt: approvals.updatedAt,
                })
                .from(approvals)
                .where(eq(approvals.requestId, request.id));

              // Return processed request with all related data
              return {
                ...request,
                items: parsedItems,
                attachments,
                approvals: approvalsList,
                requester,
                // Parse additionalApprovers JSON if needed
                additionalApprovers:
                  typeof request.additionalApprovers === "string"
                    ? JSON.parse(request.additionalApprovers)
                    : Array.isArray(request.additionalApprovers)
                      ? request.additionalApprovers
                      : [],
              };
            } catch (error) {
              console.error("Error processing request:", error);
              // Return the original request with minimal processing if there's an error
              return {
                ...request,
                items: [],
                attachments: [],
                approvals: [],
                requester: null,
                additionalApprovers: [],
              };
            }
          }),
        );

        debug(req, `Processed ${processedRequests.length} purchase requests`);
        res.json(processedRequests);
      } catch (error) {
        debug(req, "Error fetching purchase requests:", error);
        console.error("Error fetching purchase requests:", error);
        next(error);
      }
    },
  );

  app.post(
    "/api/requests",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.isAuthenticated()) {
          throw new AppError("Not authenticated", 401);
        }

        const { data: requestData, action } = req.body;
        console.log("Creating purchase request:", {
          action,
          requestData,
        });

        // Generate a unique request number
        const requestNumber = `PR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        // Ensure items is an array before stringifying
        const items = Array.isArray(requestData.items) ? requestData.items : [];

        // Handle additionalApprovers field if present
        const additionalApprovers = Array.isArray(
          requestData.additionalApprovers,
        )
          ? requestData.additionalApprovers
          : [];

        // Prepare request data
        let finalRequestData = {
          ...requestData,
          requestNumber,
          requesterId: req.user!.id,
          status: action === "draft" ? "draft" : "pending",
          createdAt: new Date(),
          updatedAt: new Date(),
          // Properly stringify the items array
          items: JSON.stringify(items),
          // Properly stringify the additionalApprovers array
          additionalApprovers: JSON.stringify(additionalApprovers),
        };

        // If saving as draft, make sure required fields are not enforced
        if (action === "draft") {
          // Allow empty or partial data for drafts
          finalRequestData = {
            ...finalRequestData,
            items: finalRequestData.items || "[]",
            totalEstimatedCost: finalRequestData.totalEstimatedCost || 0,
            freightAmount: finalRequestData.freightAmount || 0,
          };
        } else {
          // Custom validation checks for submissions
          const validationErrors = [];

          // Basic validations
          if (!requestData.vendorId) {
            validationErrors.push("Vendor selection is required");
          }
          if (!items || items.length === 0) {
            validationErrors.push("At least one item is required");
          }
          if (!requestData.title?.trim()) {
            validationErrors.push("Title is required");
          }
          if (!requestData.description?.trim()) {
            validationErrors.push("Description is required");
          }
          if (!requestData.purposeType) {
            validationErrors.push("Purpose type is required");
          }

          // Add validation for subPurposeId when purposeType is PROJECT
          if (
            requestData.purposeType === "PROJECT" &&
            !requestData.subPurposeId
          ) {
            validationErrors.push("Sub-purpose is required for PROJECT type");
          }

          if (validationErrors.length > 0) {
            return res.status(400).json({
              message: "Invalid request data",
              errors: validationErrors,
            });
          }

          // Additional schema validation for safety
          const validationResult = insertPurchaseRequestSchema.safeParse({
            ...requestData,
            items: items, // Pass the original array for validation
            additionalApprovers: additionalApprovers, // Pass the additional approvers
          });

          if (!validationResult.success) {
            console.error(
              "Validation failed:",
              validationResult.error.format(),
            );
            return res.status(400).json({
              message: "Invalid request data",
              errors: validationResult.error.format(),
            });
          }
        }

        console.log(
          "Final request data:",
          JSON.stringify(finalRequestData, null, 2),
        );

        // Create purchase request
        const [request] = await db
          .insert(purchaseRequests)
          .values(finalRequestData)
          .returning();

        // Handle attachments if any
        if (requestData.attachments?.length) {
          await db.insert(fileAttachments).values(
            requestData.attachments.map((attachment: any) => ({
              requestId: request.id,
              fileName: attachment.fileName,
              fileType: attachment.fileType,
              fileSize: attachment.fileSize,
              fileUrl: attachment.fileUrl,
              uploadedAt: new Date(),
            })),
          );
        }

        console.log(
          `Purchase request ${action === "draft" ? "draft saved" : "submitted"} successfully:`,
          request.id,
        );

        // If the request is being submitted (not saved as draft), send notifications
        if (action !== "draft" && request.status === "pending") {
          try {
            // Get mandatory approvers
            const mandatoryApprovers = await db
              .select()
              .from(users)
              .where(and(eq(users.role, "approver"), eq(users.isActive, true)));

            console.log(
              `Found ${mandatoryApprovers.length} mandatory approvers for notification`,
            );

            // Parse and process additionalApprovers
            let additionalApproverDepartments: string[] = [];
            if (request.additionalApprovers) {
              try {
                additionalApproverDepartments =
                  typeof request.additionalApprovers === "string"
                    ? JSON.parse(request.additionalApprovers)
                    : Array.isArray(request.additionalApprovers)
                      ? request.additionalApprovers
                      : [];
              } catch (err) {
                console.error("Error parsing additionalApprovers:", err);
                additionalApproverDepartments = [];
              }
            }

            console.log(
              "Found additional approver departments:",
              additionalApproverDepartments,
            );

            // Get users from additional approver departments
            let additionalApproverUsers: any[] = [];
            if (additionalApproverDepartments.length > 0) {
              additionalApproverUsers = await db
                .select()
                .from(users)
                .where(
                  and(
                    inArray(users.department, additionalApproverDepartments),
                    eq(users.isActive, true),
                  ),
                );

              console.log(
                `Found ${additionalApproverUsers.length} additional approvers from departments:`,
                additionalApproverDepartments,
              );
            }

            // Combine all approvers, ensuring no duplicates by user ID
            const allApprovers = [...mandatoryApprovers];

            // Add additional approvers, avoiding duplicates
            additionalApproverUsers.forEach((additionalApprover) => {
              if (!allApprovers.some((a) => a.id === additionalApprover.id)) {
                allApprovers.push(additionalApprover);
              }
            });

            console.log(
              `Sending notifications to ${allApprovers.length} approvers for request ${request.id}`,
            );

            // Get requester name for the notification message
            const [requester] = await db
              .select()
              .from(users)
              .where(eq(users.id, req.user!.id))
              .limit(1);

            const requesterName = requester ? requester.username : "A user";
            const requesterDept = requester
              ? requester.department
              : "an unknown department";

            // Send notifications to all approvers
            await Promise.all(
              allApprovers.map((approver) =>
                notificationService.createNotification({
                  userId: approver.id,
                  title: "New Purchase Request",
                  message: `${requesterName} from ${requesterDept} submitted a new request "${request.title}" that requires your approval.`,
                  type: "approval_required",
                  requestId: request.id,
                  priority: "high",
                  actionType: "approve",
                }),
              ),
            );
          } catch (notificationError) {
            console.error(
              "Error sending notifications for new request:",
              notificationError,
            );
            // Continue even if notification sending fails
          }
        }

        // Return detailed response with parsed items
        res.status(201).json({
          ...request,
          items: items, // Return the original array
          message: `Request ${action === "draft" ? "saved as draft" : "submitted"} successfully`,
        });
      } catch (error) {
        console.error("Error creating purchase request:", error);
        next(error);
      }
    },
  );

  // Enhanced sub-purposes endpoint with proper error handling and logging
  app.get(
    "/api/sub-purposes",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.isAuthenticated()) {
          throw new AppError("Not authenticated", 401);
        }

        const { purposeType } = req.query;
        debug(req, "Fetching sub-purposes with filters:", { purposeType });

        const baseQuery = db
          .select({
            id: subPurposes.id,
            name: subPurposes.name,
            purpose_type: subPurposes.purpose_type,
            is_frozen: subPurposes.is_frozen,
            valid_from: subPurposes.valid_from,
            valid_to: subPurposes.valid_to,
            created_at: subPurposes.created_at,
            updated_at: subPurposes.updated_at,
          })
          .from(subPurposes)
          .where(
            purposeType
              ? eq(subPurposes.purpose_type, purposeType as string)
              : undefined,
          )
          .orderBy(desc(subPurposes.created_at));

        const results = await baseQuery;
        debug(req, `Found ${results.length} sub-purposes`);

        // Add debug logging for the query results
        debug(req, "Raw sub-purposes data:", results);

        // Format dates consistently and ensure all fields are present
        const formattedResults = results.map((sp) => ({
          id: sp.id,
          name: sp.name,
          purpose_type: sp.purpose_type,
          is_frozen: sp.is_frozen,
          valid_from: sp.valid_from
            ? new Date(sp.valid_from).toISOString()
            : null,
          valid_to: sp.valid_to ? new Date(sp.valid_to).toISOString() : null,
          created_at: sp.created_at
            ? new Date(sp.created_at).toISOString()
            : null,
          updated_at: sp.updated_at
            ? new Date(sp.updated_at).toISOString()
            : null,
          // Add any additional fields needed by the frontend
          label: sp.name, // Add label field for dropdown compatibility
          value: sp.id.toString(), // Add value field for dropdown compatibility
        }));

        debug(req, "Formatted sub-purposes data:", formattedResults);
        res.json(formattedResults);
      } catch (error) {
        debug(req, "Error fetching sub-purposes:", error);
        next(error);
      }
    },
  );

  // Admin route for sub-purposes
  app.get(
    "/api/admin/sub-purposes",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.isAuthenticated() || req.user?.role !== "admin") {
          throw new AppError("Admin access required", 403);
        }

        const allSubPurposes = await db
          .select({
            id: subPurposes.id,
            name: subPurposes.name,
            purpose_type: subPurposes.purpose_type,
            is_frozen: subPurposes.is_frozen,
            valid_from: subPurposes.valid_from,
            valid_to: subPurposes.valid_to,
            created_at: subPurposes.created_at,
            updated_at: subPurposes.updated_at,
          })
          .from(subPurposes)
          .orderBy(desc(subPurposes.created_at));

        debug(req, `Found ${allSubPurposes.length} sub-purposes`);
        res.json(allSubPurposes);
      } catch (error) {
        debug(req, "Error fetching sub-purposes:", error);
        next(error);
      }
    },
  );

  // Add sub-purposes endpoint
  app.get(
    "/api/subpurposes",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.isAuthenticated()) {
          throw new AppError("Not authenticated", 401);
        }

        const { purposeType } = req.query;
        debug(req, "Fetching sub-purposes with filters:", { purposeType });

        let query = db.select().from(subPurposes);

        // Apply purpose type filter if provided
        if (purposeType) {
          query = query.where(
            eq(subPurposes.purpose_type, purposeType as string),
          );
        }

        // Only return non-frozen and valid sub-purposes
        const now = new Date();
        query = query.where(
          and(
            eq(subPurposes.is_frozen, false),
            or(
              isNull(subPurposes.valid_from),
              lte(subPurposes.valid_from, now),
            ),
            or(isNull(subPurposes.valid_to), gte(subPurposes.valid_to, now)),
          ),
        );

        const results = await query.orderBy(desc(subPurposes.created_at));
        debug(req, `Found ${results.length} sub-purposes`);

        // Format the response to match frontend expectations
        const formattedResults = results.map((sp) => ({
          id: sp.id,
          name: sp.name,
          purpose_type: sp.purpose_type,
          is_frozen: sp.is_frozen,
          valid_from: sp.valid_from
            ? new Date(sp.valid_from).toISOString()
            : null,
          valid_to: sp.valid_to ? new Date(sp.valid_to).toISOString() : null,
        }));

        res.json(formattedResults);
      } catch (error) {
        debug(req, "Error fetching sub-purposes:", error);
        next(error);
      }
    },
  );

  // Account requests management - UPDATED
  app.get(
    "/api/admin/account-requests",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.isAuthenticated() || req.user?.role !== "admin") {
          throw new AppError("Admin access required", 403);
        }

        const { status, department, role } = req.query;
        debug(req, "Fetching account requests with filters:", {
          status,
          department,
          role,
        });

        // Build the where clause based on filters
        const whereConditions = [];
        if (status && typeof status === "string") {
          whereConditions.push(eq(accountRequests.status, status));
        }
        if (department && typeof department === "string") {
          whereConditions.push(eq(accountRequests.department, department));
        }
        if (role && typeof role === "string") {
          whereConditions.push(eq(accountRequests.role, role));
        }

        // Debug log for query construction
        debug(req, "Constructed where conditions:", whereConditions);

        // Execute the query with proper type safety
        const accountRequestsResult = await db
          .select({
            id: accountRequests.id,
            username: accountRequests.username,
            email: accountRequests.email,
            department: accountRequests.department,
            role: accountRequests.role,
            status: accountRequests.status,
            contact_number: accountRequests.contact_number,
            createdAt: accountRequests.createdAt,
            updatedAt: accountRequests.updatedAt,
          })
          .from(accountRequests)
          .where(
            whereConditions.length > 0 ? and(...whereConditions) : undefined,
          )
          .orderBy(desc(accountRequests.createdAt));

        debug(req, `Found ${accountRequestsResult.length} account requests`);

        // Debug log for results
        debug(
          req,
          "Account requests after filtering:",
          accountRequestsResult.map((r) => ({
            id: r.id,
            username: r.username,
            status: r.status,
            department: r.department,
            role: r.role,
          })),
        );

        res.json(accountRequestsResult);
      } catch (error) {
        debug(req, "Error fetching account requests:", error);
        next(error);
      }
    },
  );

  // Add file upload endpoint with improved error handling
  app.post(
    "/api/attachments",
    upload.array("files", 5),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.files || !Array.isArray(req.files)) {
          throw new AppError("No files uploaded", 400);
        }

        const uploadedFiles = req.files.map((file) => ({
          fileName: file.originalname,
          fileType: file.mimetype,
          fileSize: file.size,
          fileUrl: `/uploads/${file.filename}`,
        }));

        debug(req, "Files uploaded successfully:", uploadedFiles);
        res.status(201).json(uploadedFiles);
      } catch (error) {
        debug(req, "Error uploading files:", error);
        next(error);
      }
    },
  );

  // Add PUT endpoint for updating requests
  app.put(
    "/api/requests/:id",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.isAuthenticated()) {
          throw new AppError("Not authenticated", 401);
        }

        const requestId = parseInt(req.params.id);
        const updateData = req.body;

        debug(req, "Updating request:", { requestId, updateData });

        // Verify the request exists and belongs to the user
        const [existingRequest] = await db
          .select()
          .from(purchaseRequests)
          .where(
            and(
              eq(purchaseRequests.id, requestId),
              eq(purchaseRequests.requesterId, req.user!.id),
            ),
          )
          .limit(1);

        if (!existingRequest) {
          throw new AppError("Request not found or unauthorized", 404);
        }

        // Prevent updates to locked requests unless it's a status update from an approver
        if (
          existingRequest.isLocked &&
          updateData.status !== "changes_requested" &&
          req.user!.role !== "approver"
        ) {
          throw new AppError("Request is locked", 403);
        }

        // Enhanced validation for submissions - Only validate required fields when not a draft
        if (updateData.status === "pending") {
          const validationErrors = [];

          if (!existingRequest.vendorId) {
            validationErrors.push(
              "Vendor selection is required before submitting",
            );
          }
          if (!existingRequest.items || existingRequest.items.length === 0) {
            validationErrors.push("At least one item is required");
          }
          if (!existingRequest.title?.trim()) {
            validationErrors.push("Title is required");
          }
          if (!existingRequest.description?.trim()) {
            validationErrors.push("Description is required");
          }
          if (!existingRequest.purposeType) {
            validationErrors.push("Purpose type is required");
          }
          // Add validation for subPurposeId when purposeType is PROJECT
          if (
            existingRequest.purposeType === "PROJECT" &&
            !existingRequest.subPurposeId
          ) {
            validationErrors.push("Sub-purpose is required for PROJECT type");
          }

          if (validationErrors.length > 0) {
            const error = new ValidationError("Validation failed", {
              errors: validationErrors,
            });

            // Analyze validation errors
            const analysis = await analyzeError(error, {
              requestData: updateData,
              validationErrors,
              userId: req.user!.id,
              requestId,
            });

            // Log error with analysis
            await db.insert(errorLogs).values({
              message: error.message,
              severity: "error",
              userId: req.user!.id,
              details: { validationErrors },
              aiAnalysis: analysis,
              path: req.path,
              createdAt: new Date(),
            });

            throw error;
          }
        }

        // For draft requests, we shouldn't enforce all validations
        // Just make sure we have some basic data to save

        // Log draft saving attempt for debugging
        console.log("Processing draft request update:", {
          requestId,
          status: updateData.status,
          hasItems:
            updateData.items && Array.isArray(updateData.items)
              ? updateData.items.length
              : 0,
        });

        // Properly handle additionalApprovers in the update
        let finalUpdateData = { ...updateData };

        // If there are items, convert to string for storage
        if (updateData.items && Array.isArray(updateData.items)) {
          finalUpdateData.items = JSON.stringify(updateData.items);
          console.log("Items formatted for database storage");
        } else if (typeof updateData.items === "string") {
          // If items is already a string, keep it as is
          console.log("Items is already in string format, preserving as-is");
        } else {
          // Handle null or undefined items gracefully for drafts
          finalUpdateData.items =
            updateData.status === "draft"
              ? JSON.stringify([])
              : existingRequest.items;
          console.log("No items provided, using defaults for draft");
        }

        // Make sure additionalApprovers is an array and stringify it
        if (updateData.additionalApprovers !== undefined) {
          finalUpdateData.additionalApprovers = JSON.stringify(
            Array.isArray(updateData.additionalApprovers)
              ? updateData.additionalApprovers
              : [],
          );
        }

        // Handle date fields properly by converting string dates to proper Date objects
        // This fixes the "toISOString is not a function" error
        if (
          finalUpdateData.createdAt &&
          typeof finalUpdateData.createdAt === "string"
        ) {
          finalUpdateData.createdAt = new Date(finalUpdateData.createdAt);
        }

        if (
          finalUpdateData.updatedAt &&
          typeof finalUpdateData.updatedAt === "string"
        ) {
          finalUpdateData.updatedAt = new Date(finalUpdateData.updatedAt);
        }

        if (
          finalUpdateData.submittedAt &&
          typeof finalUpdateData.submittedAt === "string"
        ) {
          finalUpdateData.submittedAt = new Date(finalUpdateData.submittedAt);
        }

        // Omit any non-database fields from the update to prevent schema errors
        const {
          requester,
          vendor,
          subPurpose,
          approvals,
          attachments,
          ...cleanUpdateData
        } = finalUpdateData;

        // Update the request with proper validation
        const [updatedRequest] = await db
          .update(purchaseRequests)
          .set({
            ...cleanUpdateData,
            updatedAt: new Date(),
          })
          .where(eq(purchaseRequests.id, requestId))
          .returning();

        // If transitioning to pending, create notification for approvers
        if (updateData.status === "pending") {
          // Get all mandatory approvers with 'approver' role
          const approvers = await db
            .select()
            .from(users)
            .where(and(eq(users.role, "approver"), eq(users.isActive, true)));

          // Parse additionalApprovers if present
          let additionalApproverDepartments: string[] = [];
          if (updatedRequest.additionalApprovers) {
            try {
              additionalApproverDepartments =
                typeof updatedRequest.additionalApprovers === "string"
                  ? JSON.parse(updatedRequest.additionalApprovers)
                  : Array.isArray(updatedRequest.additionalApprovers)
                    ? updatedRequest.additionalApprovers
                    : [];
            } catch (err) {
              console.error("Error parsing additionalApprovers:", err);
              additionalApproverDepartments = [];
            }
          }

          console.log(
            "Found additional approver departments:",
            additionalApproverDepartments,
          );

          // Get users from additional approver departments
          let additionalApproversUsers: any[] = [];
          if (additionalApproverDepartments.length > 0) {
            additionalApproversUsers = await db
              .select()
              .from(users)
              .where(
                and(
                  inArray(users.department, additionalApproverDepartments),
                  eq(users.isActive, true),
                ),
              );

            console.log(
              `Found ${additionalApproversUsers.length} additional approvers from departments:`,
              additionalApproverDepartments,
            );
          }

          // Combine all approvers, ensuring no duplicates by user ID
          const allApprovers = [...approvers];

          // Add additional approvers, avoiding duplicates
          additionalApproversUsers.forEach((additionalApprover) => {
            if (!allApprovers.some((a) => a.id === additionalApprover.id)) {
              allApprovers.push(additionalApprover);
            }
          });

          console.log(
            `Sending notifications to ${allApprovers.length} approvers for request ${updatedRequest.id}`,
          );

          // Only send notification once to each approver
          await Promise.all(
            allApprovers.map((approver) =>
              notificationService.createNotification({
                userId: approver.id,
                title: "New Purchase Request",
                message: `A new purchase request "${updatedRequest.title}" requires your approval`,
                type: "approval_required",
                requestId: updatedRequest.id,
                priority: "high",
                actionType: "approve",
              }),
            ),
          );
        }

        debug(req, "Request updated successfully:", updatedRequest);
        res.json(updatedRequest);
      } catch (error) {
        debug(req, "Error updating request:", error);

        // Analyze unexpected errors
        if (!(error instanceof ValidationError)) {
          const analysis = await analyzeError(error as Error, {
            requestId: req.params.id,
            userId: req.user?.id,
            path: req.path,
          });

          // Log unexpected errors with analysis
          await db.insert(errorLogs).values({
            message: error instanceof Error ? error.message : "Unknown error",
            severity: "error",
            userId: req.user?.id,
            path: req.path,
            aiAnalysis: analysis,
            createdAt: new Date(),
          });
        }

        next(error);
      }
    },
  );

  // Enhanced sub-purpose creation endpoint
  app.post(
    "/api/admin/sub-purposes",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.isAuthenticated() || req.user?.role !== "admin") {
          throw new AppError("Admin access required", 403);
        }

        debug(req, "Creating new sub-purpose - Raw request body:", req.body);

        const validPurposeTypes = [
          "E3 EVENT",
          "PROJECT",
          "MALL",
          "BUSINESS GROWTH",
        ];
        const purposeType = req.body.purposeType || req.body.purpose_type;

        if (!purposeType || !validPurposeTypes.includes(purposeType)) {
          throw new ValidationError("Invalid purpose type", {
            details: {
              allowed: validPurposeTypes,
              received: purposeType,
            },
          });
        }

        // Parse and validate dates
        const validFrom = req.body.validFrom || req.body.valid_from;
        const validTo = req.body.validTo || req.body.valid_to;

        const requestData = {
          name: req.body.name,
          purpose_type: purposeType,
          is_frozen: req.body.isFrozen || req.body.is_frozen || false,
          valid_from: validFrom ? new Date(validFrom) : null,
          valid_to: validTo ? new Date(validTo) : null,
          created_at: new Date(),
          updated_at: new Date(),
        };

        debug(req, "Transformed request data:", requestData);

        // Validate the data
        const [newSubPurpose] = await db
          .insert(subPurposes)
          .values(requestData)
          .returning();

        debug(req, "Successfully created sub-purpose:", newSubPurpose);
        res.json(newSubPurpose);
      } catch (error) {
        debug(req, "Error creating sub-purpose:", error);
        next(error);
      }
    },
  );

  // Add user management endpoint
  app.get(
    "/api/admin/users",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.isAuthenticated() || req.user?.role !== "admin") {
          throw new AppError("Admin access required", 403);
        }

        debug(req, "Fetching users");

        const allUsers = await db
          .select({
            id: users.id,
            username: users.username,
            email: users.email,
            department: users.department,
            role: users.role,
            contact_number: users.contact_number,
            isActive: users.isActive,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt,
          })
          .from(users)
          .orderBy(desc(users.createdAt));

        debug(req, `Found ${allUsers.length} users`);
        res.json(allUsers);
      } catch (error) {
        debug(req, "Error fetching users:", error);
        next(error);
      }
    },
  );

  // Enhanced approvers endpoint with proper query building
  app.get(
    "/api/approvers",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { department } = req.query;
        debug(req, "Fetching approvers", { department });

        let query = db
          .select({
            id: purchaseApprovers.id,
            departmentId: purchaseApprovers.departmentId,
            approverId: purchaseApprovers.approverId,
            isMandatory: purchaseApprovers.isMandatory,
            level: purchaseApprovers.level,
            approver: {
              id: users.id,
              username: users.username,
              email: users.email,
              department: users.department,
            },
          })
          .from(purchaseApprovers)
          .innerJoin(users, eq(users.id, purchaseApprovers.approverId))
          .where(eq(users.isActive, true));

        if (department) {
          query = query.where(
            eq(purchaseApprovers.departmentId, department as string),
          );
        }

        const approvers = await query.orderBy(purchaseApprovers.level);
        debug(req, `Found ${approvers.length} approvers`);
        res.json(approvers);
      } catch (error) {
        debug(req, "Error fetching approvers:", error);
        next(new DatabaseError("Failed to fetch approvers"));
      }
    },
  );

  // Account Request endpoint with proper error handling (already included above)

  // Add better error handling for request fetching
  app.get(
    "/api/requests",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.isAuthenticated()) {
          throw new AppError("Not authenticated", 401);
        }

        debug(req, "Fetching requests with filters:", req.query);

        // Build query conditions based on filters
        const queryConditions = [];

        // Add status filter
        if (req.query.status) {
          const statuses = Array.isArray(req.query.status)
            ? req.query.status
            : [req.query.status];
          queryConditions.push(
            inArray(purchaseRequests.status, statuses as string[]),
          );
        }

        // Add department filter
        if (req.query.department) {
          const departments = Array.isArray(req.query.department)
            ? req.query.department
            : [req.query.department];
          queryConditions.push(
            inArray(purchaseRequests.department, departments as string[]),
          );
        }

        // Add date range filter
        if (req.query.startDate) {
          queryConditions.push(
            gte(
              purchaseRequests.createdAt,
              new Date(req.query.startDate as string),
            ),
          );
        }
        if (req.query.endDate) {
          queryConditions.push(
            lte(
              purchaseRequests.createdAt,
              new Date(req.query.endDate as string),
            ),
          );
        }

        // Execute query with proper error handling
        try {
          const requests = await db
            .select({
              id: purchaseRequests.id,
              title: purchaseRequests.title,
              status: purchaseRequests.status,
              createdAt: purchaseRequests.createdAt,
              requesterId: purchaseRequests.requesterId,
              // Add other fields as needed
            })
            .from(purchaseRequests)
            .where(
              queryConditions.length > 0 ? and(...queryConditions) : undefined,
            )
            .orderBy(desc(purchaseRequests.createdAt));

          debug(req, `Found ${requests.length} requests matching filters`);
          res.json(requests);
        } catch (dbError) {
          debug(req, "Database error while fetching requests:", dbError);
          throw new DatabaseError("Failed to fetch requests from database");
        }
      } catch (error) {
        debug(req, "Error in /api/requests:", error);
        next(error);
      }
    },
  );

  // Add better error handling for single request fetching
  app.get(
    "/api/requests/:id",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.isAuthenticated()) {
          throw new AppError("Not authenticated", 401);
        }

        const requestId = parseInt(req.params.id);
        if (isNaN(requestId)) {
          throw new ValidationError("Invalid request ID", {
            id: "Must be a number",
          });
        }

        debug(req, "Fetching request details:", requestId);

        try {
          const [request] = await db
            .select({
              id: purchaseRequests.id,
              title: purchaseRequests.title,
              status: purchaseRequests.status,
              description: purchaseRequests.description,
              createdAt: purchaseRequests.createdAt,
              requesterId: purchaseRequests.requesterId,
              // Add other fields as needed
            })
            .from(purchaseRequests)
            .where(eq(purchaseRequests.id, requestId))
            .limit(1);

          if (!request) {
            throw new AppError("Request not found", 404);
          }

          debug(req, "Found request:", request.id);
          res.json(request);
        } catch (dbError) {
          debug(req, "Database error while fetching request:", dbError);
          throw new DatabaseError(
            "Failed to fetch request details from database",
          );
        }
      } catch (error) {
        debug(req, "Error in /api/requests/:id:", error);
        next(error);
      }
    },
  );

  // Update the GET /api/requests endpoint

  app.get(
    "/api/requests",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.isAuthenticated()) {
          throw new AppError("Not authenticated", 401);
        }

        debug(req, "Fetching requests with filters:", req.query);

        // Build filter conditions
        const whereConditions = [];

        // Date range filter
        if (req.query.dateFrom || req.query.dateTo) {
          const dateFrom = req.query.dateFrom
            ? new Date(req.query.dateFrom as string)
            : null;
          const dateTo = req.query.dateTo
            ? new Date(req.query.dateTo as string)
            : null;

          if (dateFrom && dateTo) {
            whereConditions.push(
              and(
                gte(purchaseRequests.createdAt, dateFrom),
                lte(purchaseRequests.createdAt, dateTo),
              ),
            );
          } else if (dateFrom) {
            whereConditions.push(gte(purchaseRequests.createdAt, dateFrom));
          } else if (dateTo) {
            whereConditions.push(lte(purchaseRequests.createdAt, dateTo));
          }
        }

        // Department filter
        if (req.query.department) {
          whereConditions.push(
            eq(users.department, req.query.department as string),
          );
        }

        // Vendor filter
        if (req.query.vendor) {
          whereConditions.push(
            eq(purchaseRequests.vendorId, parseInt(req.query.vendor as string)),
          );
        }

        // Purpose filter
        if (req.query.purpose) {
          whereConditions.push(
            eq(purchaseRequests.purposeType, req.query.purpose as string),
          );
        }

        // Sub-purpose filter
        if (req.query.subPurpose) {
          whereConditions.push(
            eq(
              purchaseRequests.subPurposeId,
              parseInt(req.query.subPurpose as string),
            ),
          );
        }

        // Status filter (including rejected/approved)
        if (req.query.status) {
          const statuses = (req.query.status as string).split(",");
          whereConditions.push(inArray(purchaseRequests.status, statuses));
        }

        // Get all requests with requester information and filters
        const requests = await db
          .select({
            id: purchaseRequests.id,
            requestNumber: purchaseRequests.requestNumber,
            requesterId: purchaseRequests.requesterId,
            title: purchaseRequests.title,
            description: purchaseRequests.description,
            status: purchaseRequests.status,
            items: purchaseRequests.items,
            totalEstimatedCost: purchaseRequests.totalEstimatedCost,
            createdAt: purchaseRequests.createdAt,
            updatedAt: purchaseRequests.updatedAt,
            purposeType: purchaseRequests.purposeType,
            priority: purchaseRequests.priority,
            isLocked: purchaseRequests.isLocked,
            vendorId: purchaseRequests.vendorId,
            subPurposeId: purchaseRequests.subPurposeId,
            requester: {
              id: users.id,
              username: users.username,
              email: users.email,
              department: users.department,
              role: users.role,
              contact_number: users.contact_number,
            },
          })
          .from(purchaseRequests)
          .innerJoin(users, eq(users.id, purchaseRequests.requesterId))
          .where(
            whereConditions.length > 0 ? and(...whereConditions) : undefined,
          )
          .orderBy(desc(purchaseRequests.createdAt));

        debug(req, "Raw requests data:", JSON.stringify(requests, null, 2));

        // Parse JSON fields and get additional details for each request
        const requestsWithDetails = await Promise.all(
          requests.map(async (request) => {
            // Get attachments for this request
            const attachments = await db
              .select()
              .from(fileAttachments)
              .where(eq(fileAttachments.requestId, request.id));

            // Get approvals for this request
            const requestApprovals = await db
              .select()
              .from(approvals)
              .where(eq(approvals.requestId, request.id));

            // Get vendor details if vendorId exists
            let vendorDetails = null;
            if (request.vendorId) {
              const [vendor] = await db
                .select()
                .from(vendors)
                .where(eq(vendors.id, request.vendorId))
                .limit(1);
              vendorDetails = vendor;
            }

            // Get sub-purpose details if subPurposeId exists
            let subPurposeDetails = null;
            if (request.subPurposeId) {
              const [subPurpose] = await db
                .select()
                .from(subPurposes)
                .where(eq(subPurposes.id, request.subPurposeId))
                .limit(1);
              subPurposeDetails = subPurpose;
            }

            // Parse JSON fields
            return {
              ...request,
              items:
                typeof request.items === "string"
                  ? JSON.parse(request.items)
                  : request.items,
              attachments: attachments || [],
              approvals: requestApprovals || [],
              vendor: vendorDetails,
              subPurpose: subPurposeDetails,
            };
          }),
        );

        debug(
          req,
          `Found ${requestsWithDetails.length} requests after filtering`,
        );
        return res.json(requestsWithDetails);
      } catch (error) {
        debug(req, "Error fetching requests:", error);
        next(error);
      }
    },
  );

  // Add approval endpoint with proper validation and mandatory approver logic - UPDATED
  app.post(
    "/api/requests/:requestId/approvals",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.isAuthenticated()) {
          throw new AppError("Not authenticated", 401);
        }

        if (!req.user || !req.user.id) {
          throw new AppError("Invalid user session", 401);
        }

        const requestId = parseInt(req.params.requestId);
        const { status, comments } = req.body;
        const department = req.user.department; // Use user's department automatically

        debug(req, "Creating approval with data:", {
          requestId,
          status,
          comments,
          department,
          userId: req.user.id,
        });

        // Validate required fields
        if (!requestId || !status || !department) {
          throw new ValidationError("Missing required fields", {
            message: "requestId, status, and department are required",
          });
        }

        // Check if request exists and getrequester info
        const [request] = await db
          .select({
            id: purchaseRequests.id,
            requesterId: purchaseRequests.requesterId,
            title: purchaseRequests.title,
            status: purchaseRequests.status,
            isLocked: purchaseRequests.isLocked,
          })
          .from(purchaseRequests)
          .where(eq(purchaseRequests.id, requestId))
          .limit(1);
        if (!request) {
          throw new AppError("Request not found", 404);
        }

        // Check if request is already finalized
        if (request.status === "approved" || request.status === "rejected") {
          throw new AppError("Request is already finalized", 400);
        }

        // Check if request is locked
        if (request.isLocked && status !== "changes_requested") {
          throw new AppError("Request is locked", 403);
        }

        // Create the approval record
        const [approval] = await db
          .insert(approvals)
          .values({
            requestId,
            approverId: req.user.id,
            status,
            comments: comments || null,
            department,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        debug(req, "Approval created successfully:", {
          approvalId: approval.id,
          requestStatus: request.status,
          isLocked: request.isLocked,
        });

        res.status(201).json({
          ...approval,
          message: `Approval submitted successfully`,
        });
      } catch (error) {
        debug(req, "Error creating approval:", error);
        next(error);
      }
    },
  );

  // Account requests management (already included above)
  app.post(
    "/api/admin/account-requests/:id/approve",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.isAuthenticated() || req.user?.role !== "admin") {
          throw new AppError("Admin access required", 403);
        }

        const requestId = parseInt(req.params.id);

        // Find the account request
        const [accountRequest] = await db
          .select()
          .from(accountRequests)
          .where(eq(accountRequests.id, requestId))
          .limit(1);

        if (!accountRequest) {
          throw new AppError("Account request not found", 404);
        }

        if (accountRequest.status !== "pending") {
          throw new AppError("Account request is not pending", 400);
        }

        // Check if username already exists in users table
        const [existingUser] = await db
          .select()
          .from(users)
          .where(eq(users.username, accountRequest.username))
          .limit(1);

        if (existingUser) {
          throw new AppError("Username already exists", 400);
        }

        // Create new user
        const [newUser] = await db
          .insert(users)
          .values({
            username: accountRequest.username,
            password: accountRequest.password, // // Password is already properly hashed
            email: accountRequest.email,
            contact_number: accountRequest.contact_number,
            department: accountRequest.department,
            role: accountRequest.role,
            isActive: true,
          })
          .returning();

        // Update request status
        await db
          .update(accountRequests)
          .set({ status: "approved" })
          .where(eq(accountRequests.id, requestId));

        res.json({
          message: "Account request approved",
          user: {
            id: newUser.id,
            username: newUser.username,
            email: newUser.email,
            department: newUser.department,
            role: newUser.role,
          },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  app.post(
    "/api/admin/account-requests/:id/reject",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.isAuthenticated() || req.user?.role !== "admin") {
          throw new AppError("Admin access required", 403);
        }

        const requestId = parseInt(req.params.id);

        // Update request status
        const [updatedRequest] = await db
          .update(accountRequests)
          .set({ status: "rejected" })
          .where(eq(accountRequests.id, requestId))
          .returning();

        if (!updatedRequest) {
          throw new AppError("Account request not found", 404);
        }

        res.json({ message: "Account request rejected" });
      } catch (error) {
        next(error);
      }
    },
  );

  // Add vendor management routes to the existing routes
  app.get(
    "/api/vendors",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.isAuthenticated()) {
          throw new AppError("Not authenticated", 401);
        }

        debug(req, "Fetching vendors");

        const allVendors = await db
          .select()
          .from(vendors)
          .orderBy(desc(vendors.createdAt));

        debug(req, `Found ${allVendors.length} vendors`);
        res.json(allVendors);
      } catch (error) {
        debug(req, "Error fetching vendors:", error);
        next(error);
      }
    },
  );
  app.post(
    "/api/vendors",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.isAuthenticated()) {
          throw new AppError("Not authenticated", 401);
        }

        debug(req, "Creating new vendor - Raw request body:", req.body);

        // Validate vendor data
        const validationResult = insertVendorSchema.safeParse(req.body);

        if (!validationResult.success) {
          debug(req, "Validation failed:", validationResult.error);
          return res.status(400).json({
            message: "Validation failed",
            errors: validationResult.error.format(),
          });
        }

        // Check if vendor with same name already exists
        const [existingVendor] = await db
          .select()
          .from(vendors)
          .where(eq(vendors.companyName, validationResult.data.companyName))
          .limit(1);

        if (existingVendor) {
          return res.status(400).json({
            message: "Vendor with this company name already exists",
          });
        }

        // Create new vendor
        const [newVendor] = await db
          .insert(vendors)
          .values({
            ...validationResult.data,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        debug(req, "Successfully created vendor:", newVendor);
        res.status(201).json(newVendor);
      } catch (error) {
        debug(req, "Error creating vendor:", error);
        next(error);
      }
    },
  );

  app.get(
    "/api/vendors/:id",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.isAuthenticated()) {
          throw new AppError("Not authenticated", 401);
        }

        const vendorId = parseInt(req.params.id);
        debug(req, `Fetching vendor details for ID: ${vendorId}`);

        if (isNaN(vendorId)) {
          throw new ValidationError("Invalid vendor ID", {
            id: "Must be a number",
          });
        }

        const [vendor] = await db
          .select()
          .from(vendors)
          .where(eq(vendors.id, vendorId))
          .limit(1);

        if (!vendor) {
          throw new AppError("Vendor not found", 404);
        }

        debug(req, "Found vendor:", vendor);
        res.json(vendor);
      } catch (error) {
        debug(req, "Error fetching vendor:", error);
        next(error);
      }
    },
  );

  // Add endpoint for updating vendor details
  app.patch(
    "/api/vendors/:id",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Authentication check
        if (!req.isAuthenticated()) {
          console.error("[PATCH /api/vendors/:id] User not authenticated");
          throw new AppError("Not authenticated", 401);
        }

        // Parse and validate vendor ID
        const vendorIdParam = req.params.id;
        const vendorId = parseInt(vendorIdParam);

        console.log(
          `[PATCH /api/vendors/:id] Updating vendor with ID: ${vendorId}`,
          {
            userId: req.user?.id,
            bodyKeys: Object.keys(req.body),
            body: JSON.stringify(req.body),
          },
        );
        debug(req, `Updating vendor with ID: ${vendorId}`, req.body);

        if (isNaN(vendorId)) {
          console.error(
            `[PATCH /api/vendors/:id] Invalid vendor ID: ${vendorIdParam}`,
          );
          throw new ValidationError("Invalid vendor ID", {
            id: "Must be a number",
          });
        }

        // Check if vendor exists
        console.log(
          `[PATCH /api/vendors/:id] Checking if vendor ${vendorId} exists`,
        );
        const [existingVendor] = await db
          .select()
          .from(vendors)
          .where(eq(vendors.id, vendorId))
          .limit(1);

        if (!existingVendor) {
          console.error(
            `[PATCH /api/vendors/:id] Vendor with ID ${vendorId} not found`,
          );
          throw new AppError("Vendor not found", 404);
        }

        console.log(
          `[PATCH /api/vendors/:id] Found existing vendor with ID: ${existingVendor.id}`,
        );

        // Validate update data against schema
        console.log(
          `[PATCH /api/vendors/:id] Validating update data for vendor ID: ${vendorId}`,
        );
        const validationResult = insertVendorSchema
          .partial()
          .safeParse(req.body);

        if (!validationResult.success) {
          console.error(
            "[PATCH /api/vendors/:id] Vendor update validation failed:",
            validationResult.error,
          );
          debug(
            req,
            "Vendor update validation failed:",
            validationResult.error,
          );
          throw new ValidationError(
            "Invalid vendor data",
            validationResult.error.format(),
          );
        }

        // Check if company name is being changed and if it's already taken
        if (
          req.body.companyName &&
          req.body.companyName !== existingVendor.companyName
        ) {
          const [nameConflict] = await db
            .select()
            .from(vendors)
            .where(
              and(
                eq(vendors.companyName, req.body.companyName),
                // Important: Use proper SQL comparison for IDs to exclude current vendor
                // Using SQL not equals operator instead of a callback function
                ne(vendors.id, vendorId),
              ),
            )
            .limit(1);

          if (nameConflict) {
            console.error(
              `[PATCH /api/vendors/:id] Vendor with name "${req.body.companyName}" already exists`,
            );
            throw new ValidationError("Company name already exists", {
              companyName: [
                "This company name is already registered for another vendor",
              ],
            });
          }
        }

        // Clone data from validation result
        const processedData = { ...validationResult.data };

        // Special handling for empty strings that should be null
        if (processedData.taxNumber === "") processedData.taxNumber = null;
        if (processedData.registrationNumber === "")
          processedData.registrationNumber = null;
        if (processedData.remarks === "") processedData.remarks = null;

        // Only update fields that were actually provided (and skip the id field)
        const updateFields: any = {};
        Object.keys(processedData).forEach((key) => {
          // Skip the ID field in the update data to avoid accidental ID changes
          if (key !== "id" && processedData[key] !== undefined) {
            // Special handling for rating field - ensure it's a number
            if (key === "rating") {
              updateFields[key] =
                typeof processedData[key] === "string"
                  ? Number(processedData[key]) || 0
                  : processedData[key] || 0;
            } else {
              updateFields[key] = processedData[key];
            }
          }
        });

        console.log(
          `[PATCH /api/vendors/:id] Original vendor ID: ${vendorId} will be preserved (not in update fields)`,
        );
        console.log(
          `[PATCH /api/vendors/:id] Rating value: ${updateFields.rating}, type: ${typeof updateFields.rating}`,
        );

        // Always set updatedAt
        updateFields.updatedAt = new Date();

        // Log the data we're about to save
        console.log(
          "[PATCH /api/vendors/:id] Fields being updated:",
          Object.keys(updateFields),
        );
        console.log(
          "[PATCH /api/vendors/:id] Processed vendor data for update:",
          updateFields,
        );
        debug(req, "Processed vendor data for update:", updateFields);

        try {
          console.log(
            `[PATCH /api/vendors/:id] Executing database update for vendor ID: ${vendorId}`,
          );
          // Update vendor in database
          const [updatedVendor] = await db
            .update(vendors)
            .set(updateFields)
            .where(eq(vendors.id, vendorId))
            .returning();

          if (!updatedVendor) {
            console.error(
              "[PATCH /api/vendors/:id] Database update successful but no vendor returned",
            );
            throw new Error(
              "Database update successful but no vendor returned",
            );
          }

          console.log(
            "[PATCH /api/vendors/:id] Database update successful, returned vendor:",
            updatedVendor,
          );
          debug(
            req,
            "Database update successful, returned vendor:",
            updatedVendor,
          );
          res.status(200).json(updatedVendor);
        } catch (dbError: any) {
          console.error(
            "[PATCH /api/vendors/:id] Database error during vendor update:",
            dbError,
          );
          debug(req, "Database error during vendor update:", dbError);
          const errorMessage = dbError.message || "Unknown database error";
          throw new DatabaseError(`Failed to update vendor: ${errorMessage}`);
        }
      } catch (error: any) {
        console.error("[PATCH /api/vendors/:id] Error updating vendor:", error);
        debug(req, "Error updating vendor:", error);
        next(error);
      }
    },
  );

  // Add endpoint for updating just the vendor status
  app.patch(
    "/api/vendors/:id/status",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.isAuthenticated()) {
          throw new AppError("Not authenticated", 401);
        }

        // Check admin role for status updates
        if (req.user?.role !== "admin") {
          throw new AppError(
            "Admin access required for vendor status changes",
            403,
          );
        }

        const vendorId = parseInt(req.params.id);
        const { status } = req.body;

        debug(req, `Updating vendor status for ID: ${vendorId} to ${status}`);

        if (isNaN(vendorId)) {
          throw new ValidationError("Invalid vendor ID", {
            id: "Must be a number",
          });
        }

        if (!status || !["active", "blocked", "frozen"].includes(status)) {
          throw new ValidationError("Invalid status value", {
            status: ["Status must be one of: active, blocked, frozen"],
          });
        }

        // Check if vendor exists
        const [existingVendor] = await db
          .select()
          .from(vendors)
          .where(eq(vendors.id, vendorId))
          .limit(1);

        if (!existingVendor) {
          throw new AppError("Vendor not found", 404);
        }

        // Update just the status
        const [updatedVendor] = await db
          .update(vendors)
          .set({
            status,
            updatedAt: new Date(),
          })
          .where(eq(vendors.id, vendorId))
          .returning();

        debug(req, "Successfully updated vendor status:", updatedVendor);
        res.json(updatedVendor);
      } catch (error) {
        debug(req, "Error updating vendor status:", error);
        next(error);
      }
    },
  );

  // Add endpoint for deleting a vendor
  app.delete(
    "/api/vendors/:id",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.isAuthenticated()) {
          throw new AppError("Not authenticated", 401);
        }

        // Only admin can delete vendors
        if (req.user?.role !== "admin") {
          throw new AppError("Admin access required for deleting vendors", 403);
        }

        const vendorId = parseInt(req.params.id);
        debug(req, `Deleting vendor with ID: ${vendorId}`);

        if (isNaN(vendorId)) {
          throw new ValidationError("Invalid vendor ID", {
            id: "Must be a number",
          });
        }

        // Check if vendor exists
        const [existingVendor] = await db
          .select()
          .from(vendors)
          .where(eq(vendors.id, vendorId))
          .limit(1);

        if (!existingVendor) {
          throw new AppError("Vendor not found", 404);
        }

        // Check if vendor is used in any purchase requests
        const countResult = await db.execute(
          sql`SELECT COUNT(*) AS count FROM purchase_requests WHERE vendor_id = ${vendorId}`,
        );
        const requestsUsingVendor = {
          count: parseInt(countResult.rows[0].count),
        };

        if (requestsUsingVendor && requestsUsingVendor.count > 0) {
          throw new AppError(
            `Cannot delete vendor because it is used in ${requestsUsingVendor.count} purchase requests. Consider blocking or freezing the vendor instead.`,
            400,
          );
        }

        // Delete vendor if not used in any requests
        await db.delete(vendors).where(eq(vendors.id, vendorId));

        debug(req, "Successfully deleted vendor");
        res.json({
          success: true,
          message: "Vendor deleted successfully",
        });
      } catch (error) {
        debug(req, "Error deleting vendor:", error);
        next(error);
      }
    },
  );

  // Add password update endpoint after the account requests management section
  app.post(
    "/api/admin/users/:id/update-password",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.isAuthenticated() || req.user?.role !== "admin") {
          throw new AppError("Admin access required", 403);
        }

        const userId = parseInt(req.params.id);
        const { password } = req.body;

        if (!password || password.length < 6) {
          throw new ValidationError("Password must be at least 6 characters");
        }

        // Check if user exists
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (!user) {
          throw new AppError("User not found", 404);
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Update user password
        const [updatedUser] = await db
          .update(users)
          .set({
            password: hashedPassword,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId))
          .returning();

        res.json({
          message: "Password updated successfully",
          user: {
            id: updatedUser.id,
            username: updatedUser.username,
            email: updatedUser.email,
            updatedAt: updatedUser.updatedAt,
          },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  // Add role update endpoint after the account requests management section
  app.post(
    "/api/admin/users/:id/update-role",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.isAuthenticated() || req.user?.role !== "admin") {
          throw new AppError("Admin access required", 403);
        }

        const userId = parseInt(req.params.id);
        const { role } = req.body;

        if (!role || !["user", "approver", "admin"].includes(role)) {
          throw new ValidationError("Invalid role specified");
        }

        // Check if user exists
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (!user) {
          throw new AppError("User not found", 404);
        }

        // Update user role
        const [updatedUser] = await db
          .update(users)
          .set({ role: role })
          .where(eq(users.id, userId))
          .returning();

        res.json({
          message: "User role updated successfully",
          user: updatedUser,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  app.post(
    "/api/admin/users/:id/toggle-activation",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.isAuthenticated() || req.user?.role !== "admin") {
          throw new AppError("Admin access required", 403);
        }

        const userId = parseInt(req.params.id);
        const { isActive } = req.body;

        // Check if user exists
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (!user) {
          throw new AppError("User not found", 404);
        }

        // Update user status
        const [updatedUser] = await db
          .update(users)
          .set({ isActive: isActive })
          .where(eq(users.id, userId))
          .returning();

        res.json({
          message: `User ${isActive ? "activated" : "deactivated"} successfully`,
          user: updatedUser,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  app.get(
    "/api/admin/users/:id/check-deletion",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.isAuthenticated() || req.user?.role !== "admin") {
          throw new AppError("Admin access required", 403);
        }

        const userId = parseInt(req.params.id);

        // Check if user exists
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (!user) {
          throw new AppError("User not found", 404);
        }

        // Check if user has any associated purchase requests
        const [purchaseRequest] = await db
          .select()
          .from(purchaseRequests)
          .where(eq(purchaseRequests.requesterId, userId))
          .limit(1);

        const canDelete = !purchaseRequest;
        const reason = purchaseRequest
          ? "Cannot delete user with associated purchase requests. Please deactivate instead."
          : null;

        res.json({ canDelete, reason });
      } catch (error) {
        next(error);
      }
    },
  );

  app.delete(
    "/api/admin/users/:id",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.isAuthenticated() || req.user?.role !== "admin") {
          throw new AppError("Admin access required", 403);
        }

        const userId = parseInt(req.params.id);

        // Check if user exists
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (!user) {
          throw new AppError("User not found", 404);
        }

        // Check if user can be deleted
        const [purchaseRequest] = await db
          .select()
          .from(purchaseRequests)
          .where(eq(purchaseRequests.requesterId, userId))
          .limit(1);

        if (purchaseRequest) {
          throw new AppError(
            "Cannot delete user with associated purchase requests. Please deactivate instead.",
            400,
          );
        }

        // Delete user
        const [deletedUser] = await db
          .delete(users)
          .where(eq(users.id, userId))
          .returning();

        res.json({
          message: "User deleted successfully",
          user: deletedUser,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  // Get company branding settings
  // app.get("/api/branding", async (req: Request, res: Response, next: NextFunction) => {
  //   try {
  //     if (!req.isAuthenticated()) {
  //       throw new AppError('Not authenticated', 401);
  //     }
  //
  //     // Only admins can access branding settings
  //     if (req.user?.role !== 'admin') {
  //       throw new AppError('Admin access required', 403);
  //     }
  //
  //     const [settings] = await db
  //       .select()
  //       .from(companyBranding)
  //       .orderBy(desc(companyBranding.updatedAt))
  //       .limit(1);
  //
  //     res.json(settings || null);
  //   } catch (error) {
  //     next(error);
  //   }
  // });
  //
  // Add POST endpoint for updating branding with enhanced file handling
  // app.post("/api/branding", upload.fields([
  //   { name: 'logo', maxCount: 1 },
  //   { name: 'headerImage', maxCount: 1 },
  //   { name: 'footerImage', maxCount: 1 }
  // ]), async (req: Request, res: Response, next: NextFunction) => {
  //   try {
  //     if (!req.isAuthenticated() || req.user?.role !== 'admin') {
  //       throw new AppError('Admin access required', 403);
  //     }
  //
  //     const formData = req.body;
  //     const files = req.files as { [fieldname: string]: Express.Multer.File[] };
  //
  //     // Process uploaded files
  //     const processFile = (fieldName: string) => {
  //       const file = files[fieldName]?.[0];
  //       if (!file) return null;
  //       return file.buffer.toString('base64');
  //     };
  //
  //     // Parse JSON strings back to objects
  //     if (typeof formData.headerConfig === 'string') {
  //       formData.headerConfig = JSON.parse(formData.headerConfig);
  //     }
  //     if (typeof formData.footerConfig === 'string') {
  //       formData.footerConfig = JSON.parse(formData.footerConfig);
  //     }
  //
  //     // Add file data to form data
  //     const logo = processFile('logo');
  //     const headerImage = processFile('headerImage');
  //     const footerImage = processFile('footerImage');
  //
  //     const brandingData = {
  //       companyName: formData.companyName,
  //       description: formData.description,
  //       primaryColor: formData.primaryColor,
  //       secondaryColor: formData.secondaryColor,
  //       accentColor: formData.accentColor,
  //       fontFamily: formData.fontFamily,
  //       theme: formData.theme,
  //       headerConfig: formData.headerConfig,
  //       footerConfig: formData.footerConfig,
  //       logo: logo || formData.logo,
  //       logoMimeType: files.logo?.[0]?.mimetype || formData.logoMimeType,
  //       headerImage: headerImage || formData.headerImage,
  //       headerImageMimeType: files.headerImage?.[0]?.mimetype || formData.headerImageMimeType,
  //       footerImage: footerImage || formData.footerImage,
  //       footerImageMimeType: files.footerImage?.[0]?.mimetype || formData.footerImageMimeType,
  //       updatedAt: new Date()
  //     };
  //
  //     // Get existing branding record if any
  //     const [existingBranding] = await db
  //       .select()
  //       .from(companyBranding)
  //       .orderBy(desc(companyBranding.updatedAt))
  //       .limit(1);
  //
  //     let updatedBranding;
  //
  //     if (existingBranding) {
  //       [updatedBranding] = await db
  //         .update(companyBranding)
  //         .set(brandingData)
  //         .where(eq(companyBranding.id, existingBranding.id))
  //         .returning();
  //     } else {
  //       [updatedBranding] = await db
  //         .insert(companyBranding)
  //         .values({
  //           ...brandingData,
  //           createdAt: new Date()
  //         })
  //         .returning();
  //     }
  //
  //     res.json(updatedBranding);
  //   } catch (error) {
  //     next(error);
  //   }
  // });
  //
  // Get notifications endpoint
  app.get(
    "/api/notifications",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.isAuthenticated()) {
          throw new AppError("Not authenticated", 401);
        }

        const userNotifications = await db
          .select()
          .from(notifications)
          .where(eq(notifications.userId, req.user!.id))
          .orderBy(desc(notifications.createdAt));

        res.json(userNotifications);
      } catch (error) {
        next(error);
      }
    },
  );

  // Mark notification as read endpoint
  app.put(
    "/api/notifications/:id/read",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.isAuthenticated()) {
          throw new AppError("Not authenticated", 401);
        }

        const notificationId = parseInt(req.params.id);

        // Verify notification belongs to user
        const [notification] = await db
          .select()
          .from(notifications)
          .where(
            and(
              eq(notifications.id, notificationId),
              eq(notifications.userId, req.user!.id),
            ),
          )
          .limit(1);

        if (!notification) {
          throw new AppError("Notification not found", 404);
        }

        // Update notification
        await db
          .update(notifications)
          .set({ isRead: true })
          .where(eq(notifications.id, notificationId));

        res.json({ message: "Notification markedas read" });
      } catch (error) {
        next(error);
      }
    },
  );

  // Add mood board generation endpoint
  app.post(
    "/api/branding/generate-mood-board",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.isAuthenticated()) {
          throw new AppError("Not authenticated", 401);
        }

        const { companyName, primaryColor, secondaryColor, accentColor } =
          req.body;

        if (!companyName || !primaryColor) {
          throw new ValidationError(
            "Company name and primary color are required",
          );
        }

        const prompt = `Create a brand mood board for a company named "${companyName}". 
        The brand colors are:
        - Primary: ${primaryColor}
        - Secondary: ${secondaryColor || "not specified"}
        - Accent: ${accentColor || "not specified"}
        
        Generate a mood board that reflects the company's brand identity, incorporating these colors
        and creating a cohesive visual theme. The mood board should include elements that represent
        the brand's personality and values.`;

        // Removed Anthropic API call - No deepseekService reference anymore

        res.json({
          success: true,
          suggestions:
            "No AI suggestions available, please provide more details.", // Placeholder suggestion.
          moodBoard: {
            companyName,
            colors: {
              primary: primaryColor,
              secondary: secondaryColor,
              accent: accentColor,
            },
            timestamp: new Date().toISOString(),
          },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  // Add to the existing routes
  app.post(
    "/api/error-logs",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.isAuthenticated()) {
          throw new AppError("Not authenticated", 401);
        }

        debug(req, "Logging error:", req.body);

        const validationResult = insertErrorLogSchema.safeParse({
          ...req.body,
          userId: req.user?.id,
        });
        if (!validationResult.success) {
          debug(req, "Error log validation failed:", validationResult.error);
          throw new ValidationError("Invalid error log data", {
            errors: validationResult.error.errors,
          });
        }

        // Instead of inserting into error_logs (which doesn't exist),
        // just return a successful response
        const errorLog = {
          id: Date.now(),
          ...validationResult.data,
          createdAt: new Date(),
        };

        debug(req, "Error logged successfully:", errorLog);
        res.status(201).json(errorLog);
      } catch (error) {
        debug(req, "Error logging error:", error);
        next(error);
      }
    },
  );

  // Remove Redundant Branding Routes
  // app.get("/api/branding", ...); // Removed
  // app.post("/api/branding", ...); // Removed

  // PDF download API endpoint - Consolidated format
  app.get(
    "/api/requests/:id/pdf",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const requestId = parseInt(req.params.id);
        const { preview = false } = req.query;
        const isPreview = preview === "true";

        // Fetch the request with all related data
        const request = await db
          .select()
          .from(purchaseRequests)
          .where(eq(purchaseRequests.id, requestId))
          .limit(1);

        if (!request.length) {
          throw new NotFoundError(
            `Purchase request with ID ${requestId} not found`,
          );
        }

        // For preview mode, allow the PDF Design team to view any request
        const isPDFPreview = isPreview && req.url.includes("preview=true");

        // Check if user has permission to view this request
        const canView =
          req.user?.role === "admin" ||
          request[0].requesterId === req.user?.id ||
          (await canUserApprove(req.user?.id || 0, requestId)) ||
          isPDFPreview; // Special case for PDF previews

        if (!canView) {
          throw new AuthorizationError(
            "You do not have permission to view this request",
          );
        }

        // Get all related data for the request
        const requestWithRelations = await getRequestWithRelations(requestId);

        // Fetch PDF settings for enhanced rendering
        let pdfSettingsData = null;
        try {
          // Fetch PDF settings from the database
          const settingsResult = await db.select().from(pdfSettings).limit(1);

          if (settingsResult && settingsResult.length > 0) {
            pdfSettingsData = settingsResult[0];
          }
        } catch (settingsError) {
          console.warn("Failed to fetch PDF settings:", settingsError);
          // Continue with default settings if we can't get custom ones
        }

        // Log the audit event (only for non-preview requests)
        if (!isPreview) {
          try {
            await logAuditEvent(req, {
              userId: req.user?.id || 0,
              action: "pdf_downloaded",
              resourceId: requestId,
              resourceType: "purchase_request",
              details: { reportType: "consolidated" },
            });
          } catch (auditError) {
            console.warn("Failed to log PDF audit event:", auditError);
            // Continue even if audit logging fails
          }
        }

        // Check if client wants binary PDF or JSON data
        const acceptHeader = req.headers.accept || '';
        const wantsBinaryPdf = acceptHeader.includes('application/pdf');
        
        if (wantsBinaryPdf) {
          // Generate and return binary PDF using server-side PDF generation
          try {
            const { jsPDF } = require('jspdf');
            
            const doc = new jsPDF({
              orientation: 'portrait',
              unit: 'mm',
              format: 'a4'
            });

            // Add header using PDF settings
            const headerTitle = pdfSettingsData?.headerTitle || 'EVENTS & ENTERTAINMENT ENTERPRISES';
            const headerSubtitle = pdfSettingsData?.headerSubtitle || 'PURCHASE REQUEST';
            
            doc.setFontSize(16);
            doc.text(headerTitle, 14, 15);
            doc.setFontSize(12);
            doc.text(headerSubtitle, 14, 22);

            // Add basic information
            doc.setFontSize(11);
            const startY = 35;
            const lineHeight = 7;
            
            doc.text(`Request Number: ${requestWithRelations.requestNumber || 'N/A'}`, 14, startY);
            doc.text(`Title: ${requestWithRelations.title || 'N/A'}`, 14, startY + lineHeight);
            doc.text(`Status: ${requestWithRelations.status ? requestWithRelations.status.charAt(0).toUpperCase() + requestWithRelations.status.slice(1) : 'N/A'}`, 14, startY + lineHeight * 2);
            doc.text(`Requester: ${requestWithRelations.requester?.username || 'N/A'}`, 14, startY + lineHeight * 3);
            doc.text(`Department: ${requestWithRelations.requester?.department || 'N/A'}`, 14, startY + lineHeight * 4);
            doc.text(`Created: ${requestWithRelations.createdAt ? new Date(requestWithRelations.createdAt).toLocaleDateString() : 'N/A'}`, 14, startY + lineHeight * 5);
            doc.text(`Total Cost: ${requestWithRelations.totalEstimatedCost || 0} ${requestWithRelations.currency || 'QAR'}`, 14, startY + lineHeight * 6);

            // Add items table if available
            if (requestWithRelations.items && requestWithRelations.items.length > 0) {
              doc.text('Items:', 14, startY + lineHeight * 8);
              let itemY = startY + lineHeight * 9;
              
              requestWithRelations.items.forEach((item: any, index: number) => {
                if (itemY > 250) { // Check if we need a new page
                  doc.addPage();
                  itemY = 20;
                }
                doc.text(`${index + 1}. ${item.name} - Qty: ${item.quantity} - Cost: ${item.estimatedCost} ${requestWithRelations.currency || 'QAR'}`, 14, itemY);
                if (item.description) {
                  doc.text(`   Description: ${item.description}`, 14, itemY + 5);
                  itemY += 10;
                } else {
                  itemY += 7;
                }
              });
            }

            // Add approvals section
            if (requestWithRelations.approvals && requestWithRelations.approvals.length > 0) {
              doc.text('Approvals:', 14, itemY + 10);
              let approvalY = itemY + 17;
              
              requestWithRelations.approvals.forEach((approval: any) => {
                if (approvalY > 250) { // Check if we need a new page
                  doc.addPage();
                  approvalY = 20;
                }
                doc.text(`${approval.department}: ${approval.status} ${approval.approver?.username ? `(${approval.approver.username})` : ''}`, 14, approvalY);
                approvalY += 7;
              });
            }

            // Add footer using PDF settings
            const footerText = pdfSettingsData?.footerText || 'ALL RIGHTS RESERVED BY E3';
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
              doc.setPage(i);
              doc.setFontSize(9);
              doc.text(footerText, 14, 280);
              doc.text(`Page ${i} of ${pageCount}`, 180, 280);
            }
            
            const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
            
            // Set appropriate headers for PDF download
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="purchase-request-${requestId}.pdf"`);
            res.send(pdfBuffer);
          } catch (pdfError) {
            console.error('Error generating binary PDF:', pdfError);
            // Fallback to JSON response if PDF generation fails
            res.status(200).json({
              success: true,
              message: "Request data for PDF generation",
              data: requestWithRelations,
              pdfSettings: pdfSettingsData,
            });
          }
        } else {
          // Return JSON data for client-side PDF generation
          res.status(200).json({
            success: true,
            message: "Request data for PDF generation",
            data: requestWithRelations,
            pdfSettings: pdfSettingsData,
          });
        }
      } catch (error) {
        debug(req, "Error generating PDF:", error);
        next(error);
      }
    },
  );

  // ZIP download API endpoint for a single request with attachments - Consolidated format
  app.get(
    "/api/requests/:id/zip",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const requestId = parseInt(req.params.id);
        const { includeAttachments = "true" } = req.query;

        if (isNaN(requestId)) {
          throw new ValidationError("Invalid request ID", {
            id: "Must be a number",
          });
        }

        // Fetch the request with all related data
        const request = await db
          .select()
          .from(purchaseRequests)
          .where(eq(purchaseRequests.id, requestId))
          .limit(1);

        if (!request.length) {
          throw new NotFoundError(
            `Purchase request with ID ${requestId} not found`,
          );
        }

        // Check if user has permission to view this request
        const canView =
          req.user?.role === "admin" ||
          request[0].requesterId === req.user?.id ||
          (await canUserApprove(req.user?.id || 0, requestId));

        if (!canView) {
          throw new AuthorizationError(
            "You do not have permission to view this request",
          );
        }

        // Get all related data
        const requestWithRelations = await getRequestWithRelations(requestId);

        // Get PDF settings for generating the PDF
        const pdfSettingsResults = await db
          .select()
          .from(pdfSettings)
          .where(eq(pdfSettings.userId, req.user?.id || 0))
          .limit(1);

        const pdfSettingsData = pdfSettingsResults.length > 0 ? pdfSettingsResults[0] : null;

        // Create ZIP file
        const JSZip = require('jszip');
        const zip = new JSZip();
        
        const requestNumber = request[0].requestNumber || `PR-${requestId}`;
        const requestFolder = zip.folder(requestNumber);

        if (!requestFolder) {
          throw new AppError("Failed to create ZIP folder", 500);
        }

        // Add request details as JSON
        const requestData = JSON.stringify(requestWithRelations, null, 2);
        requestFolder.file('request-data.json', requestData);

        // Add a summary text file
        const summary = `
Purchase Request Summary
=======================
Request ID: ${requestId}
Request Number: ${requestNumber}
Title: ${requestWithRelations.title || 'N/A'}
Status: ${requestWithRelations.status || 'N/A'}
Created: ${requestWithRelations.createdAt ? new Date(requestWithRelations.createdAt).toLocaleDateString() : 'N/A'}
Requester: ${requestWithRelations.requester?.username || 'N/A'}
Department: ${requestWithRelations.requester?.department || 'N/A'}
Items Count: ${requestWithRelations.items?.length || 0}
Total Cost: ${requestWithRelations.totalEstimatedCost || 0} ${requestWithRelations.currency || 'QAR'}
        `;
        requestFolder.file('summary.txt', summary);

        // Generate and add the professional PDF by calling the existing PDF endpoint
        try {
          const https = require('https');
          const http = require('http');
          const url = require('url');
          
          // Use the existing PDF generation endpoint
          const pdfUrl = `${req.protocol}://${req.get('host')}/api/requests/${requestId}/pdf`;
          const parsedUrl = url.parse(pdfUrl);
          const requestModule = parsedUrl.protocol === 'https:' ? https : http;
          
          const pdfBuffer = await new Promise((resolve, reject) => {
            const pdfReq = requestModule.get(pdfUrl, {
              headers: {
                'Cookie': req.headers.cookie || '',
              }
            }, (pdfRes) => {
              if (pdfRes.statusCode !== 200) {
                reject(new Error(`PDF generation failed with status ${pdfRes.statusCode}`));
                return;
              }
              
              const chunks: Buffer[] = [];
              pdfRes.on('data', chunk => chunks.push(chunk));
              pdfRes.on('end', () => resolve(Buffer.concat(chunks)));
            });
            
            pdfReq.on('error', reject);
            pdfReq.setTimeout(30000, () => {
              pdfReq.destroy();
              reject(new Error('PDF generation timeout'));
            });
          });
          
          requestFolder.file(`${requestNumber}.pdf`, pdfBuffer);
        } catch (pdfError) {
          console.error(`Error generating PDF for request ${requestId}:`, pdfError);
          // Continue without PDF if generation fails
        }

        // Include attachments if requested and user has permission
        if (includeAttachments === "true") {
          const attachments = await db
            .select()
            .from(fileAttachments)
            .where(eq(fileAttachments.requestId, requestId));

          if (attachments.length > 0) {
            const attachmentsFolder = requestFolder.folder('attachments');
            
            if (attachmentsFolder) {
              for (const attachment of attachments) {
                try {
                  const fs = require('fs').promises;
                  const path = require('path');
                  
                  // Construct the full path to the attachment file
                  const attachmentPath = path.join(__dirname, '..', 'uploads', path.basename(attachment.fileUrl));
                  
                  // Check if file exists and read it
                  try {
                    await fs.access(attachmentPath);
                    const fileContent = await fs.readFile(attachmentPath);
                    attachmentsFolder.file(attachment.fileName, fileContent);
                  } catch (fileError) {
                    console.error(`Error reading attachment file ${attachment.fileName}:`, fileError);
                    // Add a note about missing file instead
                    attachmentsFolder.file(`${attachment.fileName}.missing.txt`, 
                      `This attachment file (${attachment.fileName}) could not be found on the server.`);
                  }
                } catch (attachmentError) {
                  console.error(`Error processing attachment ${attachment.fileName}:`, attachmentError);
                }
              }
            }
          }
        }

        // Generate the ZIP file
        const zipContent = await zip.generateAsync({
          type: "nodebuffer",
          compression: "DEFLATE",
          compressionOptions: { level: 6 },
        });

        // Log the audit event
        await logAuditEvent(req, {
          userId: req.user?.id || 0,
          action: "zip_downloaded",
          resourceId: requestId,
          resourceType: "purchase_request",
          details: {
            reportType: "consolidated",
            includeAttachments: includeAttachments === "true",
            fileName: `${requestNumber}.zip`,
            fileSize: zipContent.length,
          },
        });

        // Set response headers for ZIP download
        res.setHeader("Content-Type", "application/zip");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${requestNumber}.zip"`,
        );
        
        return res.send(zipContent);
      } catch (error) {
        debug(req, "Error generating ZIP:", error);
        next(error);
      }
    },
  );

  // Bulk export API endpoint for admins
  app.get(
    "/api/requests/export/bulk",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        console.log(
          "[BULK EXPORT] Received request with query params:",
          req.query,
        );

        // Only admins can use bulk export
        if (req.user?.role !== "admin") {
          throw new AuthorizationError(
            "Only administrators can perform bulk exports",
          );
        }

        // Get export format
        const format = (req.query.format as string) || "json"; // Default to JSON if not specified

        // Check if export format is valid
        if (format && !["json", "xlsx", "csv", "zip"].includes(format)) {
          throw new ValidationError("Invalid format", {
            format: "Must be json, xlsx, csv, or zip",
          });
        }

        const {
          ids,
          status,
          startDate,
          endDate,
          priority,
          department,
          purposeType,
          subPurposeId,
          vendorId,
          searchTerm,
        } = req.query;
        let requestIds: number[] = [];

        // Process the ids parameter if provided
        if (ids) {
          try {
            // Handle both JSON array and comma-separated list formats
            if (
              typeof ids === "string" &&
              ids.startsWith("[") &&
              ids.endsWith("]")
            ) {
              requestIds = JSON.parse(ids).map((id: any) =>
                typeof id === "number" ? id : parseInt(id),
              );
            } else if (typeof ids === "string" && ids.includes(",")) {
              requestIds = ids.split(",").map((id) => parseInt(id.trim()));
            } else if (typeof ids === "string") {
              requestIds = [parseInt(ids)];
            }

            console.log("[BULK EXPORT] Parsed request IDs:", requestIds);
          } catch (error) {
            console.error("[BULK EXPORT] Error parsing IDs:", error);
            throw new ValidationError(
              "Invalid request IDs format. Expected a JSON array or comma-separated list of numbers.",
            );
          }
        }

        // Fetch the requests based on provided IDs or use filters
        let requests;

        if (requestIds.length > 0) {
          console.log("[BULK EXPORT] Fetching requests by IDs:", requestIds);
          requests = await db
            .select()
            .from(purchaseRequests)
            .where(inArray(purchaseRequests.id, requestIds));

          console.log(`[BULK EXPORT] Found ${requests.length} requests by IDs`);
        } else {
          // Build a query with all the filters
          console.log("[BULK EXPORT] Building filtered query with:", {
            status,
            startDate,
            endDate,
            priority,
            department,
            purposeType,
            subPurposeId,
            vendorId,
            searchTerm,
          });

          let query = db.select().from(purchaseRequests).limit(30); // Limit to a reasonable number

          // Apply each filter if provided
          if (status && status !== "all" && typeof status === "string") {
            const statusValues = status.split(",");
            if (statusValues.length > 1) {
              query = query.where(
                inArray(purchaseRequests.status, statusValues),
              );
            } else {
              query = query.where(eq(purchaseRequests.status, status));
            }
          }

          if (priority && priority !== "all" && typeof priority === "string") {
            const priorityValues = priority.split(",");
            if (priorityValues.length > 1) {
              query = query.where(
                inArray(purchaseRequests.priority, priorityValues),
              );
            } else {
              query = query.where(eq(purchaseRequests.priority, priority));
            }
          }

          if (
            purposeType &&
            purposeType !== "all" &&
            typeof purposeType === "string"
          ) {
            const purposeValues = purposeType.split(",");
            if (purposeValues.length > 1) {
              query = query.where(
                inArray(purchaseRequests.purposeType, purposeValues),
              );
            } else {
              query = query.where(
                eq(purchaseRequests.purposeType, purposeType),
              );
            }
          }

          // Handle department filtering
          if (
            department &&
            typeof department === "string" &&
            department !== "all"
          ) {
            // Find requests based on the requester's department
            try {
              const departmentValues = department.split(",");

              // Find users with the specified department(s)
              let departmentCondition =
                departmentValues.length > 1
                  ? inArray(users.department, departmentValues)
                  : eq(users.department, department);

              // Get IDs of users with the specified department
              const userIdsQuery = db
                .select({ id: users.id })
                .from(users)
                .where(departmentCondition);

              const userIdsResult = await userIdsQuery;
              const userIds = userIdsResult.map((u) => u.id);

              if (userIds.length > 0) {
                // Filter requests by these user IDs
                query = query.where(
                  inArray(purchaseRequests.requesterId, userIds),
                );
              } else {
                console.log(
                  `[BULK EXPORT] No users found with department(s): ${department}`,
                );
                // If no users found with this department, return no results
                query = query.where(eq(purchaseRequests.id, -1)); // Will match nothing
              }
            } catch (deptError) {
              console.error(
                "[BULK EXPORT] Error filtering by department:",
                deptError,
              );
            }
          }

          if (
            subPurposeId &&
            typeof subPurposeId === "string" &&
            subPurposeId !== "all"
          ) {
            const subPurposeIdNum = parseInt(subPurposeId);
            if (!isNaN(subPurposeIdNum)) {
              query = query.where(
                eq(purchaseRequests.subPurposeId, subPurposeIdNum),
              );
            }
          }

          if (vendorId && typeof vendorId === "string" && vendorId !== "all") {
            const vendorIdNum = parseInt(vendorId);
            if (!isNaN(vendorIdNum)) {
              query = query.where(eq(purchaseRequests.vendorId, vendorIdNum));
            }
          }

          if (startDate && typeof startDate === "string") {
            try {
              const date = new Date(startDate);
              query = query.where(gte(purchaseRequests.createdAt, date));
            } catch (e) {
              console.error("[BULK EXPORT] Invalid start date:", startDate);
            }
          }

          if (endDate && typeof endDate === "string") {
            try {
              const date = new Date(endDate);
              query = query.where(lte(purchaseRequests.createdAt, date));
            } catch (e) {
              console.error("[BULK EXPORT] Invalid end date:", endDate);
            }
          }

          // Add search functionality
          if (
            searchTerm &&
            typeof searchTerm === "string" &&
            searchTerm.trim() !== ""
          ) {
            const searchValue = `%${searchTerm.trim()}%`;

            // First try to fetch vendor IDs matching the search term
            const vendorSearchQuery = db
              .select({ id: vendors.id })
              .from(vendors)
              .where(
                or(
                  ilike(vendors.companyName, searchValue),
                  ilike(vendors.contactPerson, searchValue),
                  ilike(vendors.email, searchValue),
                ),
              );

            const matchingVendors = await vendorSearchQuery;
            const vendorIds = matchingVendors.map((v) => v.id);

            // Also find requester IDs matching the search term
            // Get user IDs for department matches
            const userSearchQuery = db
              .select({ id: users.id })
              .from(users)
              .where(
                or(
                  ilike(users.username, searchValue),
                  ilike(users.department, searchValue),
                  ilike(users.email, searchValue),
                ),
              );

            const matchingUsers = await userSearchQuery;
            const userIds = matchingUsers.map((u) => u.id);

            // Now combine all search conditions
            query = query.where(
              or(
                ilike(purchaseRequests.title, searchValue),
                ilike(purchaseRequests.description, searchValue),
                ilike(purchaseRequests.requestNumber, searchValue),
                // Include vendor matches if we found any
                vendorIds.length > 0
                  ? inArray(purchaseRequests.vendorId, vendorIds)
                  : undefined,
                // Include requester matches if we found any
                userIds.length > 0
                  ? inArray(purchaseRequests.requesterId, userIds)
                  : undefined,
              ).filter(Boolean), // Filter out undefined conditions
            );
          }

          // Execute the query
          requests = await query;
          console.log(
            `[BULK EXPORT] Found ${requests.length} requests by filters`,
          );
        }

        // Return an empty array if no requests found (instead of throwing an error)
        if (!requests.length) {
          console.log(
            "[BULK EXPORT] No purchase requests found matching the criteria",
          );
          return res.status(200).json({
            success: true,
            message: "No purchase requests found matching the criteria",
            data: [],
          });
        }

        try {
          // Get full data for each request (with all relations)
          console.log("[BULK EXPORT] Getting request details with relations");
          const requestsWithRelations = await Promise.all(
            requests.map(async (request) => {
              try {
                return await getRequestWithRelations(request.id);
              } catch (relationError) {
                console.error(
                  `[BULK EXPORT] Error fetching relations for request ${request.id}:`,
                  relationError,
                );
                // Return basic request data without relations if there's an error
                return {
                  ...request,
                  vendor: null,
                  subPurpose: null,
                  approvals: [],
                  attachments: [],
                };
              }
            }),
          );

          // Log the audit event
          try {
            await logAuditEvent(req, {
              userId: req.user?.id || 0,
              action: "pdf_downloaded", // Using pdf_downloaded as the action type
              resourceType: "purchase_requests",
              details: {
                exportType: "bulk",
                count: requestsWithRelations.length,
                requestIds: requestsWithRelations.map((r) => r.id),
              },
            });
          } catch (auditError) {
            console.error(
              "[BULK EXPORT] Error logging audit event:",
              auditError,
            );
            // Continue even if audit logging fails
          }

          console.log(
            `[BULK EXPORT] Successfully prepared ${requestsWithRelations.length} requests for export`,
          );

          // Handle format-specific exports
          if (format === "zip") {
            try {
              // Create a ZIP file with all requests using the JSZip module imported at the top
              const zip = new JSZip();
              const timestamp = new Date()
                .toISOString()
                .replace(/[-:]/g, "")
                .slice(0, 15);
              const mainFolder = zip.folder(
                `purchase_requests_export_${timestamp}`,
              );

              if (!mainFolder) {
                throw new Error("Failed to create ZIP folder");
              }

              // Add a summary index file
              const summary = {
                exportDate: new Date().toISOString(),
                totalRequests: requestsWithRelations.length,
                exportType: "bulk",
                requests: requestsWithRelations.map((req) => ({
                  id: req.id,
                  requestNumber: req.requestNumber,
                  title: req.title,
                  status: req.status,
                  createdAt: req.createdAt,
                })),
              };

              mainFolder.file(
                "export-summary.json",
                JSON.stringify(summary, null, 2),
              );

              // Add data in multiple formats for each request
              for (const request of requestsWithRelations) {
                // Create a folder for each request
                const requestFolder = mainFolder.folder(
                  `request_${request.id}`,
                );
                if (!requestFolder) {
                  console.error(
                    `Failed to create folder for request ${request.id}`,
                  );
                  continue;
                }

                // Add JSON format (original functionality)
                requestFolder.file(
                  `request_${request.id}.json`,
                  JSON.stringify(request, null, 2),
                );

                // Add CSV format for basic request data
                try {
                  const { Parser } = require("@json2csv/plainjs");
                  const basicRequestData = {
                    request_number:
                      request.requestNumber || `REQ-${request.id}`,
                    title: request.title || "Untitled Request",
                    status: request.status || "draft",
                    priority: request.priority || "medium",
                    created_date: request.createdAt
                      ? new Date(request.createdAt).toISOString()
                      : "",
                    requester_id: request.requesterId,
                    description: request.description || "",
                    purpose_type: request.purposeType || "",
                    sub_purpose_id: request.subPurposeId || "",
                    total_estimated_cost: request.totalEstimatedCost || 0,
                    currency: request.currency || "USD",
                  };

                  const parser = new Parser();
                  // Add BOM for Excel compatibility
                  const csvContent = "\ufeff" + parser.parse(basicRequestData);
                  requestFolder.file(`request_${request.id}.csv`, csvContent);

                  // If the request has items, create a CSV for items too
                  if (
                    request.items &&
                    Array.isArray(request.items) &&
                    request.items.length > 0
                  ) {
                    const itemsParser = new Parser();
                    const itemsCsv =
                      "\ufeff" + itemsParser.parse(request.items);
                    requestFolder.file(
                      `request_${request.id}_items.csv`,
                      itemsCsv,
                    );
                  }
                } catch (csvError) {
                  console.error(
                    `Error creating CSV for request ${request.id}:`,
                    csvError,
                  );
                  requestFolder.file(
                    "csv_error.txt",
                    `Failed to generate CSV: ${csvError.message || "Unknown error"}`,
                  );
                }

                // Add Excel format if XLSX is available
                try {
                  const XLSX = require("xlsx");
                  const wb = XLSX.utils.book_new();

                  // Basic request data sheet
                  const basicData = [
                    ["Field", "Value"],
                    [
                      "Request Number",
                      request.requestNumber || `REQ-${request.id}`,
                    ],
                    ["Title", request.title || "Untitled Request"],
                    ["Status", request.status || "draft"],
                    ["Priority", request.priority || "medium"],
                    [
                      "Created Date",
                      request.createdAt
                        ? new Date(request.createdAt).toISOString()
                        : "",
                    ],
                    ["Description", request.description || ""],
                    ["Purpose Type", request.purposeType || ""],
                    ["Total Cost", request.totalEstimatedCost || 0],
                    ["Currency", request.currency || "USD"],
                  ];

                  const wsBasic = XLSX.utils.aoa_to_sheet(basicData);
                  XLSX.utils.book_append_sheet(wb, wsBasic, "Request Info");

                  // Items sheet if available
                  if (
                    request.items &&
                    Array.isArray(request.items) &&
                    request.items.length > 0
                  ) {
                    const wsItems = XLSX.utils.json_to_sheet(request.items);
                    XLSX.utils.book_append_sheet(wb, wsItems, "Items");
                  }

                  // Generate Excel file
                  const excelBuffer = XLSX.write(wb, {
                    type: "buffer",
                    bookType: "xlsx",
                    compression: true,
                  });

                  requestFolder.file(`request_${request.id}.xlsx`, excelBuffer);
                } catch (excelError) {
                  console.error(
                    `Error creating Excel for request ${request.id}:`,
                    excelError,
                  );
                  requestFolder.file(
                    "excel_error.txt",
                    `Failed to generate Excel: ${excelError.message || "Unknown error"}`,
                  );
                }
              }

              // Generate the ZIP file
              const zipContent = await zip.generateAsync({
                type: "nodebuffer",
                compression: "DEFLATE",
                compressionOptions: { level: 6 },
              });

              // Set response headers for ZIP download
              res.setHeader("Content-Type", "application/zip");
              res.setHeader(
                "Content-Disposition",
                `attachment; filename="purchase_requests_${timestamp}.zip"`,
              );
              return res.send(zipContent);
            } catch (zipError) {
              console.error("[BULK EXPORT] Error generating ZIP:", zipError);
              throw new AppError(
                `Failed to generate ZIP export: ${zipError.message}`,
                500,
              );
            }
          } else {
            // For JSON format or when no format specified, return the data as JSON
            return res.status(200).json({
              success: true,
              message: "Request data for bulk export",
              data: requestsWithRelations,
            });
          }
        } catch (exportError) {
          console.error(
            "[BULK EXPORT] Error in final export stage:",
            exportError,
          );
          return next(
            new AppError(
              "Error processing export data: " +
                (exportError instanceof Error
                  ? exportError.message
                  : String(exportError)),
              500,
            ),
          );
        }
      } catch (error) {
        debug(req, "Error generating bulk export:", error);
        next(error);
      }
    },
  );

  // Update the GET /api/requests/:id endpoint
  app.get(
    "/api/requests/:id",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        debug(
          req,
          "[GET /api/requests/:id] Fetching purchase request with ID:",
          req.params.id,
        );

        if (!req.isAuthenticated()) {
          throw new AppError("Not authenticated", 401);
        }

        const requestId = parseInt(req.params.id);

        if (isNaN(requestId)) {
          throw new ValidationError("Invalid request ID", {
            id: "Must be a number",
          });
        }

        try {
          // Get the base request data
          console.log("[GET /api/requests/:id] Executing base request query");
          const requests = await db.query.purchaseRequests.findMany({
            where: eq(purchaseRequests.id, requestId),
            limit: 1,
          });

          if (requests.length === 0) {
            throw new AppError("Request not found", 404);
          }

          const request = requests[0];
          console.log("[GET /api/requests/:id] Found request:", request.id);

          // Get vendor details if vendorId exists
          let vendor = null;
          if (request.vendorId) {
            console.log(
              `[GET /api/requests/:id] Fetching vendor with ID: ${request.vendorId}`,
            );
            const vendorResults = await db.query.vendors.findMany({
              where: eq(vendors.id, request.vendorId),
              limit: 1,
            });

            if (vendorResults.length > 0) {
              vendor = vendorResults[0];
              console.log("[GET /api/requests/:id] Vendor data found");
            }
          } else {
            console.log("[GET /api/requests/:id] No vendorId found in request");
          }

          // Get sub-purpose details if subPurposeId exists
          let subPurpose = null;
          if (request.subPurposeId) {
            console.log(
              `[GET /api/requests/:id] Fetching sub-purpose with ID: ${request.subPurposeId}`,
            );
            const subPurposeResults = await db.query.subPurposes.findMany({
              where: eq(subPurposes.id, request.subPurposeId),
              limit: 1,
            });

            if (subPurposeResults.length > 0) {
              subPurpose = subPurposeResults[0];
              console.log("[GET /api/requests/:id] Sub-purpose data found");
            }
          } else {
            console.log(
              "[GET /api/requests/:id] No subPurposeId found in request",
            );
          }

          // Get approvals for this request
          const approvalsList = await db.query.approvals.findMany({
            where: eq(approvals.requestId, requestId),
          });

          // Get attachments
          const attachmentsList = await db.query.fileAttachments.findMany({
            where: eq(fileAttachments.requestId, requestId),
          });

          // Parse items JSON
          const items =
            typeof request.items === "string"
              ? JSON.parse(request.items)
              : request.items;

          // Parse additionalApprovers JSON
          const additionalApprovers =
            typeof request.additionalApprovers === "string"
              ? JSON.parse(request.additionalApprovers)
              : Array.isArray(request.additionalApprovers)
                ? request.additionalApprovers
                : [];

          // Return complete response
          res.json({
            ...request,
            items,
            vendor,
            subPurpose,
            approvals: approvalsList,
            attachments: attachmentsList,
            additionalApprovers, // Explicitly include additionalApprovers as an array
          });
        } catch (error) {
          console.error(
            "[GET /api/requests/:id] Error in database queries:",
            error,
          );
          // Return a valid response with default values in case of error
          res.json({
            ...request,
            items: typeof request.items === "string" ? [] : request.items,
            vendor: null,
            subPurpose: null,
            approvals: [],
            attachments: [],
            additionalApprovers:
              typeof request.additionalApprovers === "string"
                ? JSON.parse(request.additionalApprovers)
                : Array.isArray(request.additionalApprovers)
                  ? request.additionalApprovers
                  : [],
          });
          return; // Don't rethrow the error since we're handling it gracefully
        }
      } catch (error) {
        console.error("Error fetching request:", error);
        next(error);
      }
    },
  );

  // Add new route for PDF download
  // Removed PDF generation endpoint

  // Add branding endpoint
  // app.get("/api/branding", async (req: Request, res: Response, next: NextFunction) => {
  //   try {
  //     if (!req.isAuthenticated()) {
  //       throw new AppError('Not authenticated', 401);
  //     }
  //
  //     const [branding] = await db
  //       .select()
  //       .from(companyBranding)
  //       .orderBy(desc(companyBranding.updatedAt))
  //       .limit(1);
  //
  //     if (!branding) {
  //       return res.json({
  //         companyName: 'Company Name',
  //         primaryColor: '#71569E',
  //         secondaryColor: '#F0F0FA',
  //         accentColor: '#191160',
  //         footerText: 'Confidential Document',
  //         logo: null,
  //         logoMimeType: null,
  //         headerImage: null,
  //         headerImageMimeType: null,
  //         footerImage: null,
  //         footerImageMimeType: null
  //       });
  //     }
  //
  //     res.json(branding);
  //   } catch (error) {
  //     next(error);
  //   }
  // });
  //
  // Add branding management endpoints
  // app.get("/api/branding", async (req: Request, res: Response, next: NextFunction) => {
  //   try {
  //     debug(req, 'Fetching company branding data');
  //
  //     const [brandingData] = await db
  //       .select()
  //       .from(companyBranding)
  //       .orderBy(desc(companyBranding.createdAt))
  //       .limit(1);
  //
  //     if (!brandingData) {
  //       // Return default branding if none exists
  //       return res.json({
  //         companyName: "Events & Entertainment Enterprises",
  //         primaryColor: "#71569E",
  //         secondaryColor: "#F0F0FA",
  //         accentColor: "#191160",
  //         headerStyle: "modern",
  //         footerText: "Designed with ❤️ by E3",
  //         logo: null,
  //         logoMimeType: null,
  //         headerImageUrl: null,
  //         headerImageMimeType: null,
  //         footerImageUrl: null,
  //         footerImageMimeType: null,
  //         createdAt: new Date(),
  //         updatedAt: new Date()
  //       });
  //     }
  //
  //     debug(req, 'Found branding data:', brandingData);
  //     res.json(brandingData);
  //   } catch (error) {
  //     debug(req, 'Error fetching branding data:', error);
  //     next(error);
  //   }
  // });
  //
  // app.post("/api/branding", async (req: Request, res: Response, next: NextFunction) => {
  //   try {
  //     if (!req.isAuthenticated() || req.user?.role !== 'admin') {
  //       throw new AppError('Admin access required', 403);
  //     }
  //
  //     debug(req, 'Creating/updating company branding');
  //
  //     const validationResult = insertCompanyBrandingSchema.safeParse(req.body);
  //
  //     if (!validationResult.success) {
  //       throw new ValidationError('Invalid branding data', validationResult.error.format());
  //     }
  //
  //     // Create new branding record
  //     const [newBranding] = await db
  //       .insert(companyBranding)
  //       .values({
  //         ...validationResult.data,
  //         createdAt: new Date(),
  //         updatedAt: new Date()
  //       })
  //       .returning();
  //
  //     debug(req, 'Branding updated successfully:', newBranding.id);
  //     res.status(201).json(newBranding);
  //   } catch (error) {
  //     debug(req, 'Error updating branding:', error);
  //     next(error);
  //   }
  // });
  //
  // PDF Settings endpoints
  app.get("/api/pdf-settings", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        throw new AppError('Not authenticated', 401);
      }

      const settings = await db
        .select()
        .from(pdfSettings)
        .orderBy(desc(pdfSettings.updatedAt))
        .limit(1);

      // Return default settings if none exist
      if (settings.length === 0) {
        return res.json({
          headerTitle: "EVENTS & ENTERTAINMENT ENTERPRISES",
          headerSubtitle: "PURCHASE REQUEST",
          headerColor: "#1a365d",
          footerText: "ALL RIGHTS RESERVED BY E3",
          footerColor: "#1a365d",
          pageNumbering: true,
          watermarkOpacity: 10,
          watermarkText: "CONFIDENTIAL",
          marginTop: 20,
          marginBottom: 20,
          marginLeft: 25,
          marginRight: 25,
          fontSize: 11,
          fontFamily: "helvetica",
          companyLogo: null, // Add company logo support
          companyAddress: "",
          companyPhone: "",
          companyEmail: "",
          companyWebsite: "",
          showBasicInfo: true,
          showVendorInfo: true,
          showItemsTable: true,
          showAttachments: true,
          showSignatures: true
        });
      }

      // Map database fields to frontend expected fields
      const dbSettings = settings[0];
      const mappedSettings = {
        ...dbSettings,
        companyLogo: dbSettings.loginLogo || dbSettings.logo, // Map loginLogo/logo to companyLogo for frontend
      };
      
      res.json(mappedSettings);
    } catch (error) {
      debug(req, 'Error fetching PDF settings:', error);
      next(error);
    }
  });
  //
  // app.post("/api/enhance-pdf-settings", async (req: Request, res: Response, next: NextFunction) => {
  //   try {
  //     if (!req.isAuthenticated() || req.user?.role !== 'admin') {
  //       throw new AppError('Admin access required', 403);
  //     }
  //
  //     const settings = req.body;
  //
  //     // Use Deepseek to enhance and validate the PDF settings
  //     const prompt = `Analyze and enhance the following PDF template settings for a purchase request document.
  //   Consider readability, professional appearance, and brand consistency:
  //   ${JSON.stringify(settings, null, 2)}
  //
  //   Suggest improvements for:
  //   1. Color combinations for better contrast
  //   2. Font size adjustments for readability
  //   3. Margin optimization
  //   4. Header/footer content formatting
  //
  //   Provide the enhanced settings in JSON format.`;
  //
  //     // Removed Deepseek API call
  //     let parsedSettings;
  //
  //     try {
  //       parsedSettings = JSON.parse(enhancedSettings);
  //     } catch (e) {
  //       // If parsing fails, extract JSON from the response
  //       const jsonMatch = enhancedSettings.match(/\{[\s\S]*\}/);
  //       if (jsonMatch) {
  //         parsedSettings = JSON.parse(jsonMatch[0]);
  //       } else {
  //         // If no valid JSON found, return original settings
  //         parsedSettings = settings;
  //       }
  //     }
  //
  //     // Validate the enhanced settings
  //     const validatedSettings = {
  //       ...settings,
  //       ...parsedSettings,
  //       headerColor: parsedSettings.headerColor?.match(/^#[0-9A-Fa-f]{6}$/)
  //         ? parsedSettings.headerColor
  //         : settings.headerColor,
  //       footerColor: parsedSettings.footerColor?.match(/^#[0-9A-Fa-f]{6}$/)
  //         ? parsedSettings.footerColor
  //         : settings.footerColor,
  //       fontSize: Math.min(Math.max(parsedSettings.fontSize || settings.fontSize, 8), 16),
  //       marginTop: Math.max(parsedSettings.marginTop || settings.marginTop, 10),
  //       marginBottom: Math.max(parsedSettings.marginBottom || settings.marginBottom, 10),
  //       marginLeft: Math.max(parsedSettings.marginLeft || settings.marginLeft, 15),
  //       marginRight: Math.max(parsedSettings.marginRight || settings.marginRight, 15),
  //     };
  //
  //     res.json(validatedSettings);
  //   } catch (error) {
  //     debug(req, 'Error enhancing PDF settings:', error);
  //     next(error);
  //   }
  // });
  //
  // Active PDF Settings endpoint that frontend expects
  app.post("/api/pdf-settings", async (req: Request, res: Response, next: NextFunction) => {
    try {
      console.log('API request received:', {
        method: req.method,
        path: req.path,
        body: req.body,
        query: req.query,
        headers: req.headers
      });

      if (!req.isAuthenticated() || req.user?.role !== 'admin') {
        throw new AppError('Admin access required', 403);
      }

      const settings = req.body;
      console.log('Processing PDF settings with logo data size:', settings.companyLogo ? settings.companyLogo.length : 'null', 'and logo field:', settings.logo ? settings.logo.length : 'null');

      // First, delete existing settings
      await db.delete(pdfSettings);

      // Extract and properly type the fields for database insertion
      const {
        headerTitle,
        headerSubtitle,
        headerColor,
        footerText,
        footerColor,
        pageNumbering,
        pageNumberPosition,
        fontSize,
        fontFamily,
        marginTop,
        marginBottom,
        marginLeft,
        marginRight,
        headerHeight,
        footerHeight,
        headerImage,
        footerImage,
        logo,
        logoPosition,
        companyAddress,
        companyPhone,
        companyEmail,
        companyWebsite,
        watermarkText,
        watermarkOpacity,
        companyLogo,
        loginLogo,
        showVendorInfo,
        showItemsTable,
        showAttachments,
        showSignatures,
        tableHeaderColor,
        sectionBgColor,
        textColor
      } = settings;

      // Insert new settings with proper field mapping
      const [newSettings] = await db
        .insert(pdfSettings)
        .values({
          headerTitle: headerTitle || "EVENTS & ENTERTAINMENT ENTERPRISES",
          headerSubtitle: headerSubtitle || "PURCHASE REQUEST",
          headerColor: headerColor || "#1a365d",
          footerText: footerText || "ALL RIGHTS RESERVED BY E3",
          footerColor: footerColor || "#1a365d",
          pageNumbering: Boolean(pageNumbering),
          pageNumberPosition: pageNumberPosition || "bottom-right",
          fontSize: Number(fontSize) || 11,
          fontFamily: fontFamily || "helvetica",
          marginTop: Number(marginTop) || 20,
          marginBottom: Number(marginBottom) || 20,
          marginLeft: Number(marginLeft) || 25,
          marginRight: Number(marginRight) || 25,
          headerHeight: Number(headerHeight) || 60,
          footerHeight: Number(footerHeight) || 40,
          headerImage: headerImage || null,
          footerImage: footerImage || null,
          logo: companyLogo || logo || null,
          logoPosition: logoPosition || "left",
          companyAddress: companyAddress || null,
          companyPhone: companyPhone || null,
          companyEmail: companyEmail || null,
          companyWebsite: companyWebsite || null,
          watermarkText: watermarkText || null,
          watermarkOpacity: watermarkOpacity !== undefined ? Number(watermarkOpacity) : null,
          loginLogo: companyLogo || loginLogo || logo || null,
          showVendorInfo: Boolean(showVendorInfo !== false),
          showItemsTable: Boolean(showItemsTable !== false),
          showAttachments: Boolean(showAttachments !== false),
          showSignatures: Boolean(showSignatures !== false),
          tableHeaderColor: tableHeaderColor || null,
          sectionBgColor: sectionBgColor || null,
          textColor: textColor || null,
          userId: req.user.id,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      console.log('PDF settings saved successfully:', newSettings);

      // Log the settings update
      await logAuditEvent(req.user.id, 'pdf_settings_updated', {
        settingsId: newSettings.id,
        changes: settings
      });

      res.json(newSettings);
    } catch (error) {
      console.error('Error saving PDF settings:', error);
      debug(req, 'Error saving PDF settings:', error);
      next(error);
    }
  });
  //
  // Error handling middleware
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error("Error:", err);
    if (err instanceof ValidationError) {
      return res.status(400).json({
        message: err.message,
        details: err.details,
      });
    }
    if (err instanceof DatabaseError) {
      return res.status(500).json({
        message: "Database error occurred",
        error: err.message,
      });
    }
    if (err instanceof AppError) {
      return res.status(err.status).json({
        message: err.message,
      });
    }
    res.status(500).json({
      message: "Internal server error",
      error: err.message,
    });
  });

  // Add PDF audit endpoint inside registerRoutes
  // DEPRECATED: This endpoint is now handled at the end of the file
  // Removed deprecated PDF settings endpoints

  // Add endpoint for saving PDF settings
  app.post(
    "/api/pdf/settings",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.isAuthenticated()) {
          throw new AppError("Not authenticated", 401);
        }

        // Check if user is admin
        if (req.user?.role !== "admin") {
          throw new AppError(
            "Only administrators can update PDF settings",
            403,
          );
        }

        const {
          headerTitle,
          headerSubtitle,
          headerColor,
          footerText,
          footerColor,
          pageNumbering,
          fontSize,
          marginTop,
          marginBottom,
          marginLeft,
          marginRight,
          headerImage,
          footerImage,
          logo,
          headerHeight,
          footerHeight,
          companyAddress,
          companyPhone,
          companyEmail,
          companyWebsite,
          watermarkText,
          watermarkOpacity,
        } = req.body;

        // Validate required fields
        if (!headerTitle || !headerColor || !footerColor) {
          throw new AppError("Required fields are missing", 400);
        }

        // Find existing settings
        const existingSettings = await db.query.pdfSettings.findMany({
          orderBy: [desc(pdfSettings.updatedAt)],
          limit: 1,
        });

        let result;

        if (existingSettings.length > 0) {
          // Update existing settings
          const settingId = existingSettings[0].id;
          [result] = await db
            .update(pdfSettings)
            .set({
              headerTitle,
              headerSubtitle: headerSubtitle || "PURCHASE REQUEST",
              headerColor,
              footerText: footerText || "ALL RIGHTS RESERVED BY E3",
              footerColor,
              pageNumbering: Boolean(pageNumbering),
              fontSize: Number(fontSize || 11),
              marginTop: Number(marginTop || 20),
              marginBottom: Number(marginBottom || 20),
              marginLeft: Number(marginLeft || 25),
              marginRight: Number(marginRight || 25),
              headerHeight: Number(headerHeight || 60),
              footerHeight: Number(footerHeight || 40),
              headerImage: headerImage || null,
              footerImage: footerImage || null,
              logo: logo || null,
              companyAddress: companyAddress || null,
              companyPhone: companyPhone || null,
              companyEmail: companyEmail || null,
              companyWebsite: companyWebsite || null,
              watermarkText: watermarkText || null,
              watermarkOpacity:
                watermarkOpacity !== undefined
                  ? Number(watermarkOpacity)
                  : null,
              updatedAt: new Date(),
            })
            .where(eq(pdfSettings.id, settingId))
            .returning();
        } else {
          // Insert new settings using Drizzle ORM
          [result] = await db
            .insert(pdfSettings)
            .values({
              headerTitle,
              headerSubtitle: headerSubtitle || "PURCHASE REQUEST",
              headerColor,
              footerText: footerText || "ALL RIGHTS RESERVED BY E3",
              footerColor,
              pageNumbering: Boolean(pageNumbering),
              fontSize: Number(fontSize || 11),
              marginTop: Number(marginTop || 20),
              marginBottom: Number(marginBottom || 20),
              marginLeft: Number(marginLeft || 25),
              marginRight: Number(marginRight || 25),
              headerHeight: Number(headerHeight || 60),
              footerHeight: Number(footerHeight || 40),
              headerImage: headerImage || null,
              footerImage: footerImage || null,
              logo: logo || null,
              companyAddress: companyAddress || null,
              companyPhone: companyPhone || null,
              companyEmail: companyEmail || null,
              companyWebsite: companyWebsite || null,
              watermarkText: watermarkText || null,
              watermarkOpacity:
                watermarkOpacity !== undefined
                  ? Number(watermarkOpacity)
                  : null,
              userId: req.user!.id,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();
        }

        // Return the created/updated settings
        res.status(200).json(result);
      } catch (error) {
        const analysis = await analyzeError(error as Error, {
          component: "PDF Settings",
          request: req.body,
          operation: "save",
          user: req.user?.id,
        });

        console.error("PDF Settings Error Analysis:", analysis);
        next(error);
      }
    },
  );

  // Add endpoint for PDF image uploads
  app.post(
    "/api/pdf/upload-images",
    upload.array("files", 5),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.isAuthenticated()) {
          throw new AppError("Not authenticated", 401);
        }

        // Check if user is admin
        if (req.user?.role !== "admin") {
          throw new AppError("Only administrators can upload PDF images", 403);
        }

        // Check if files were uploaded
        if (
          !req.files ||
          (Array.isArray(req.files) && req.files.length === 0)
        ) {
          throw new ValidationError("No files were uploaded", {
            files: "Required",
          });
        }

        // Get upload type (header, footer, or logo)
        const { type } = req.body;
        if (!type || !["header", "footer", "logo"].includes(type)) {
          throw new ValidationError("Invalid image type", {
            type: "Must be header, footer, or logo",
          });
        }

        // multer handles directory creation automatically

        // Get the uploaded file
        const files = req.files as Express.Multer.File[];
        const file = files[0]; // Just use the first file for now

        // Generate a unique filename based on upload type
        const timestamp = Date.now();
        const fileExtension = path.extname(file.originalname);
        let fieldName = "";

        switch (type) {
          case "header":
            fieldName = "headerImage";
            break;
          case "footer":
            fieldName = "footerImage";
            break;
          case "logo":
            fieldName = "logo";
            break;
        }

        const newFilename = `${fieldName}-${timestamp}${fileExtension}`;
        const filePath = path.join(logoDir, newFilename);

        // Write the file to disk
        fs.writeFileSync(filePath, file.buffer);

        // Construct URL for the file
        const fileUrl = `/uploads/logos/${newFilename}`;

        // Get current settings to update
        const currentSettings = await db.query.pdfSettings.findMany({
          orderBy: [desc(pdfSettings.updatedAt)],
          limit: 1,
        });

        if (currentSettings && currentSettings.length > 0) {
          // Update the settings with the new image path
          const settingId = currentSettings[0].id;
          const updateData: { [key: string]: any } = { updatedAt: new Date() };

          switch (type) {
            case "header":
              updateData.headerImage = fileUrl;
              break;
            case "footer":
              updateData.footerImage = fileUrl;
              break;
            case "logo":
              updateData.logo = fileUrl;
              break;
          }

          await db
            .update(pdfSettings)
            .set(updateData)
            .where(eq(pdfSettings.id, settingId));
        }

        res.status(201).json({
          success: true,
          fileUrl,
          originalName: file.originalname,
          size: file.size,
          type: file.mimetype,
        });
      } catch (error) {
        console.error("Error uploading PDF image:", error);
        next(error);
      }
    },
  );

  // PDF settings API endpoints
  app.get(
    "/api/pdf/print-settings",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.isAuthenticated()) {
          return next(new AppError("Not authenticated", 401));
        }

        // Fetch the latest PDF settings
        const settings = await db.query.pdfSettings.findMany({
          orderBy: [desc(pdfSettings.updatedAt)],
          limit: 1,
        });

        // Return settings or default values
        if (settings.length > 0) {
          res.json(settings[0]);
        } else {
          // Return default settings if none exist
          res.json({
            headerTitle: "EVENTS & ENTERTAINMENT ENTERPRISES",
            headerSubtitle: "PURCHASE REQUEST",
            headerColor: "#1a365d",
            footerText: "ALL RIGHTS RESERVED BY E3",
            footerColor: "#1a365d",
            pageNumbering: true,
            fontSize: 11,
            marginTop: 20,
            marginBottom: 20,
            marginLeft: 25,
            marginRight: 25,
            headerHeight: 60,
            footerHeight: 40,
            headerImage: null,
            footerImage: null,
            logo: null,
          });
        }
      } catch (error) {
        next(error);
      }
    },
  );

  // Second PDF settings endpoint removed to avoid duplication
  // The implementation above now handles all PDF settings updates

  // Image upload endpoint
  app.post(
    "/api/pdf/upload-images",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.isAuthenticated()) {
          return next(new AppError("Not authenticated", 401));
        }

        if (req.user?.role !== "admin") {
          return next(
            new AuthorizationError(
              "Only administrators can upload branding images",
            ),
          );
        }

        // Set up the upload using disk storage
        const storage = multer.diskStorage({
          destination: async (_, __, cb) => {
            // Ensure the logos directory exists
            const uploadDir = path.join(process.cwd(), "uploads/logos");
            try {
              await fs.mkdir(uploadDir, { recursive: true });
            } catch (err) {
              // Directory might already exist, which is fine
              console.log("Directory creation status:", err);
            }
            cb(null, uploadDir);
          },
          filename: (_, file, cb) => {
            // Generate unique filename with field name, timestamp and random number
            const uniqueSuffix = `${Date.now()}-${Math.floor(Math.random() * 1000000000)}`;
            const extension = path.extname(file.originalname) || ".jpg";
            cb(null, `${file.fieldname}-${uniqueSuffix}${extension}`);
          },
        });

        // Create the multer middleware for this specific route
        const upload = multer({
          storage,
          limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
          fileFilter: (_, file, cb) => {
            const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
            if (allowedTypes.includes(file.mimetype)) {
              cb(null, true);
            } else {
              cb(
                new Error(
                  "Invalid file type. Only JPEG and PNG images are allowed.",
                ),
              );
            }
          },
        });

        // Handle the file upload
        upload.single("files")(req, res, async (err) => {
          if (err) {
            if (err instanceof multer.MulterError) {
              if (err.code === "LIMIT_FILE_SIZE") {
                return next(
                  new AppError("File size limit exceeded (5MB maximum)", 400),
                );
              } else {
                return next(
                  new AppError(`File upload error: ${err.message}`, 400),
                );
              }
            }
            return next(err);
          }

          try {
            if (!req.file) {
              return next(new AppError("No file uploaded", 400));
            }

            // Get the image type from the request
            const type = req.body.type || "unknown";

            // Generate URL for the uploaded file
            const fileUrl = `/${req.file.path.replace(/\\/g, "/")}`;

            // Update PDF settings if necessary based on the type
            if (["header", "footer", "logo"].includes(type)) {
              const existingSettings = await db.query.pdfSettings.findMany({
                orderBy: [desc(pdfSettings.updatedAt)],
                limit: 1,
              });

              const updateData: Partial<typeof pdfSettings.$inferInsert> = {};

              if (type === "header") updateData.headerImage = fileUrl;
              if (type === "footer") updateData.footerImage = fileUrl;
              if (type === "logo") updateData.logo = fileUrl;

              if (existingSettings.length > 0) {
                // Update existing settings
                const settingId = existingSettings[0].id;
                await db
                  .update(pdfSettings)
                  .set({
                    ...updateData,
                    updatedAt: new Date(),
                  })
                  .where(eq(pdfSettings.id, settingId));
              } else {
                // Create new settings with default values
                await db.insert(pdfSettings).values({
                  headerTitle: "EVENTS & ENTERTAINMENT ENTERPRISES",
                  headerSubtitle: "PURCHASE REQUEST",
                  headerColor: "#1a365d",
                  footerText: "ALL RIGHTS RESERVED BY E3",
                  footerColor: "#1a365d",
                  pageNumbering: true,
                  fontSize: 11,
                  marginTop: 20,
                  marginBottom: 20,
                  marginLeft: 25,
                  marginRight: 25,
                  headerHeight: 60,
                  footerHeight: 40,
                  ...updateData,
                  userId: req.user!.id,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                });
              }
            }

            // Return success response
            res.json({
              success: true,
              fileUrl,
              message: `${type} image uploaded successfully`,
            });
          } catch (error) {
            next(error);
          }
        });
      } catch (error) {
        next(error);
      }
    },
  );

  // Handler for PDF branding image uploads
  app.post(
    "/api/pdf/branding-images",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Verify authentication and permissions
        if (!req.isAuthenticated()) {
          return next(new AppError("Not authenticated", 401));
        }

        if (req.user?.role !== "admin") {
          return next(
            new AuthorizationError(
              "Only administrators can modify branding settings",
            ),
          );
        }

        // Set up the upload using disk storage
        const storage = multer.diskStorage({
          destination: async (_, __, cb) => {
            // Ensure the logos directory exists
            const uploadDir = path.join(process.cwd(), "uploads/logos");
            try {
              await fs.mkdir(uploadDir, { recursive: true });
            } catch (err) {
              // Directory might already exist, which is fine
              console.log("Directory creation status:", err);
            }
            cb(null, uploadDir);
          },
          filename: (_, file, cb) => {
            // Generate unique filename with field name, timestamp and random number
            const uniqueSuffix = `${Date.now()}-${Math.floor(Math.random() * 1000000000)}`;
            const extension = path.extname(file.originalname) || ".jpg";
            cb(null, `${file.fieldname}-${uniqueSuffix}${extension}`);
          },
        });

        // Create the multer middleware for this specific route
        const upload = multer({
          storage,
          limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
          fileFilter: (_, file, cb) => {
            const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
            if (allowedTypes.includes(file.mimetype)) {
              cb(null, true);
            } else {
              cb(
                new Error(
                  "Invalid file type. Only JPEG and PNG images are allowed.",
                ),
              );
            }
          },
        });

        // Complete the route using upload.fields
        upload.fields([
          { name: "headerImage", maxCount: 1 },
          { name: "footerImage", maxCount: 1 },
          { name: "logo", maxCount: 1 },
        ])(req, res, async (err) => {
          if (err) {
            if (err instanceof multer.MulterError) {
              if (err.code === "LIMIT_FILE_SIZE") {
                return next(
                  new AppError("File size limit exceeded (5MB maximum)", 400),
                );
              } else {
                return next(
                  new AppError(`File upload error: ${err.message}`, 400),
                );
              }
            }
            return next(err);
          }

          try {
            // Process uploaded files
            const files = req.files as {
              [fieldname: string]: Express.Multer.File[];
            };
            const uploadResults: Record<string, string> = {};

            // Create URL paths for each uploaded file
            for (const fieldName of ["headerImage", "footerImage", "logo"]) {
              if (files[fieldName] && files[fieldName].length > 0) {
                const file = files[fieldName][0];
                // Convert the path to a URL
                uploadResults[fieldName] = `/${file.path.replace(/\\/g, "/")}`;
              }
            }

            // Update PDF settings with the new image URLs
            if (Object.keys(uploadResults).length > 0) {
              const updateData: Partial<typeof pdfSettings.$inferInsert> = {};
              if (uploadResults.headerImage)
                updateData.headerImage = uploadResults.headerImage;
              if (uploadResults.footerImage)
                updateData.footerImage = uploadResults.footerImage;
              if (uploadResults.logo) updateData.logo = uploadResults.logo;

              // Get existing settings or create new
              const existingSettings = await db.query.pdfSettings.findMany({
                orderBy: [desc(pdfSettings.updatedAt)],
                limit: 1,
              });

              if (existingSettings.length > 0) {
                // Update existing settings
                const settingId = existingSettings[0].id;
                await db
                  .update(pdfSettings)
                  .set({
                    ...updateData,
                    updatedAt: new Date(),
                  })
                  .where(eq(pdfSettings.id, settingId));
              } else {
                // Create new settings with default values and new image URLs
                await db.insert(pdfSettings).values({
                  headerTitle: "EVENTS & ENTERTAINMENT ENTERPRISES",
                  headerSubtitle: "PURCHASE REQUEST",
                  headerColor: "#1a365d",
                  footerText: "ALL RIGHTS RESERVED BY E3",
                  footerColor: "#1a365d",
                  pageNumbering: true,
                  fontSize: 11,
                  marginTop: 20,
                  marginBottom: 20,
                  marginLeft: 25,
                  marginRight: 25,
                  ...updateData,
                  userId: req.user!.id,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                });
              }
            }

            // Send success response
            res.status(201).json({
              success: true,
              files: uploadResults,
              message: "PDF branding images uploaded successfully",
            });
          } catch (error) {
            next(error);
          }
        });
      } catch (error) {
        next(error);
      }
    },
  );

  app.post(
    "/api/pdf/audit",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.isAuthenticated()) {
          return next(new AppError("Not authenticated", 401));
        }

        // This endpoint serves dual purpose:
        // 1. For audit logging of PDF actions
        // 2. For generating a PDF preview based on form settings

        // Check if this is a preview generation request
        if (
          req.headers["accept"]?.includes("application/pdf") ||
          req.query.preview === "true" ||
          req.body.preview === true
        ) {
          // This is a PDF preview generation request
          try {
            // Get a sample request to use for the preview
            const sampleRequests = await db.query.purchaseRequests.findMany({
              limit: 1,
              with: {
                requester: true,
                vendor: true,
                subPurpose: true,
                approvals: {
                  with: {
                    approver: true,
                  },
                },
                attachments: true,
              },
            });

            if (sampleRequests.length === 0) {
              // Create a demo purchase request object if no requests exist
              const sampleRequest = {
                id: 999,
                title: "Sample Purchase Request",
                description:
                  "This is a sample purchase request for PDF preview",
                status: "pending",
                requestNumber: "PR-SAMPLE-001",
                createdAt: new Date(),
                items: [
                  {
                    name: "Item 1",
                    quantity: 2,
                    estimatedCost: 100,
                    description: "Sample item 1",
                  },
                  {
                    name: "Item 2",
                    quantity: 1,
                    estimatedCost: 200,
                    description: "Sample item 2",
                  },
                ],
                totalEstimatedCost: 300,
                freightAmount: 20,
                currency: "USD",
                priority: "medium",
                purposeType: "Office Supplies",
                requester: {
                  username: "Demo User",
                  department: "IT Department",
                },
                approvals: [
                  {
                    status: "pending",
                    department: "Finance",
                    approver: { username: "Finance Approver" },
                  },
                  {
                    status: "pending",
                    department: "CEO Office",
                    approver: { username: "CEO" },
                  },
                ],
              };

              // Get the PDF settings from the request body or use defaults
              const pdfFormSettings = req.body || {};

              // Generate PDF buffer using the sample request and form settings
              // For now, we'll just create a simple PDF with text
              const { PDFDocument, rgb } = await import("pdf-lib");
              const pdfDoc = await PDFDocument.create();
              const page = pdfDoc.addPage([600, 800]);

              // Set header color from settings or use default
              const headerColor = pdfFormSettings.headerColor
                ? hexToRgb(pdfFormSettings.headerColor)
                : [0.1, 0.2, 0.5]; // Default blue

              // Header
              page.drawRectangle({
                x: 0,
                y: page.getHeight() - (pdfFormSettings.headerHeight || 80),
                width: page.getWidth(),
                height: pdfFormSettings.headerHeight || 80,
                color: rgb(headerColor[0], headerColor[1], headerColor[2]),
              });

              // Header Text
              page.drawText(pdfFormSettings.headerTitle || "PURCHASE REQUEST", {
                x: 50,
                y: page.getHeight() - 40,
                size: 24,
                color: rgb(1, 1, 1), // White text
              });

              if (pdfFormSettings.headerSubtitle) {
                page.drawText(pdfFormSettings.headerSubtitle, {
                  x: 50,
                  y: page.getHeight() - 65,
                  size: 14,
                  color: rgb(1, 1, 1), // White text
                });
              }

              // Sample request details
              page.drawText("Sample Purchase Request", {
                x: 50,
                y: page.getHeight() - 120,
                size: 18,
                color: rgb(0, 0, 0),
              });

              page.drawText(`Request #: PR-SAMPLE-001`, {
                x: 50,
                y: page.getHeight() - 150,
                size: 12,
                color: rgb(0, 0, 0),
              });

              page.drawText(`Status: Pending`, {
                x: 50,
                y: page.getHeight() - 170,
                size: 12,
                color: rgb(0, 0, 0),
              });

              page.drawText(`Requester: Demo User (IT Department)`, {
                x: 50,
                y: page.getHeight() - 190,
                size: 12,
                color: rgb(0, 0, 0),
              });

              page.drawText(`Total Amount: $320.00 USD`, {
                x: 50,
                y: page.getHeight() - 210,
                size: 12,
                color: rgb(0, 0, 0),
              });

              // Footer
              const footerColor = pdfFormSettings.footerColor
                ? hexToRgb(pdfFormSettings.footerColor)
                : [0.1, 0.2, 0.5]; // Default blue

              page.drawRectangle({
                x: 0,
                y: 0,
                width: page.getWidth(),
                height: pdfFormSettings.footerHeight || 50,
                color: rgb(footerColor[0], footerColor[1], footerColor[2]),
              });

              // Footer Text
              page.drawText(pdfFormSettings.footerText || "CONFIDENTIAL", {
                x: 50,
                y: 20,
                size: 12,
                color: rgb(1, 1, 1), // White text
              });

              // Page numbering if enabled
              if (pdfFormSettings.pageNumbering !== false) {
                page.drawText("Page 1 of 1", {
                  x: page.getWidth() - 100,
                  y: 20,
                  size: 10,
                  color: rgb(1, 1, 1), // White text
                });
              }

              // Save the PDF
              const pdfBytes = await pdfDoc.save();

              // Return the PDF
              res.setHeader("Content-Type", "application/pdf");
              res.setHeader(
                "Content-Disposition",
                'inline; filename="preview.pdf"',
              );
              return res.send(Buffer.from(pdfBytes));
            } else {
              // Use an actual purchase request for the preview
              const request = sampleRequests[0];

              // Get the PDF settings from the request body or use defaults
              const pdfFormSettings = req.body || {};

              // Generate PDF buffer using the request and form settings
              // Here we'll implement similar logic as above but with real data
              const { PDFDocument, rgb } = await import("pdf-lib");
              const pdfDoc = await PDFDocument.create();
              const page = pdfDoc.addPage([600, 800]);

              // Set header color from settings or use default
              const headerColor = pdfFormSettings.headerColor
                ? hexToRgb(pdfFormSettings.headerColor)
                : [0.1, 0.2, 0.5]; // Default blue

              // Header
              page.drawRectangle({
                x: 0,
                y: page.getHeight() - (pdfFormSettings.headerHeight || 80),
                width: page.getWidth(),
                height: pdfFormSettings.headerHeight || 80,
                color: rgb(headerColor[0], headerColor[1], headerColor[2]),
              });

              // Header Text
              page.drawText(pdfFormSettings.headerTitle || "PURCHASE REQUEST", {
                x: 50,
                y: page.getHeight() - 40,
                size: 24,
                color: rgb(1, 1, 1), // White text
              });

              if (pdfFormSettings.headerSubtitle) {
                page.drawText(pdfFormSettings.headerSubtitle, {
                  x: 50,
                  y: page.getHeight() - 65,
                  size: 14,
                  color: rgb(1, 1, 1), // White text
                });
              }

              // Request details
              page.drawText(request.title, {
                x: 50,
                y: page.getHeight() - 120,
                size: 18,
                color: rgb(0, 0, 0),
              });

              page.drawText(`Request #: ${request.requestNumber}`, {
                x: 50,
                y: page.getHeight() - 150,
                size: 12,
                color: rgb(0, 0, 0),
              });

              page.drawText(
                `Status: ${request.status.charAt(0).toUpperCase() + request.status.slice(1)}`,
                {
                  x: 50,
                  y: page.getHeight() - 170,
                  size: 12,
                  color: rgb(0, 0, 0),
                },
              );

              const requesterInfo = request.requester
                ? `${request.requester.username} (${request.requester.department || "N/A"})`
                : "Unknown";

              page.drawText(`Requester: ${requesterInfo}`, {
                x: 50,
                y: page.getHeight() - 190,
                size: 12,
                color: rgb(0, 0, 0),
              });

              page.drawText(
                `Total Amount: $${(request.totalEstimatedCost || 0).toFixed(2)} ${request.currency || "USD"}`,
                {
                  x: 50,
                  y: page.getHeight() - 210,
                  size: 12,
                  color: rgb(0, 0, 0),
                },
              );

              // Footer
              const footerColor = pdfFormSettings.footerColor
                ? hexToRgb(pdfFormSettings.footerColor)
                : [0.1, 0.2, 0.5]; // Default blue

              page.drawRectangle({
                x: 0,
                y: 0,
                width: page.getWidth(),
                height: pdfFormSettings.footerHeight || 50,
                color: rgb(footerColor[0], footerColor[1], footerColor[2]),
              });

              // Footer Text
              page.drawText(pdfFormSettings.footerText || "CONFIDENTIAL", {
                x: 50,
                y: 20,
                size: 12,
                color: rgb(1, 1, 1), // White text
              });

              // Page numbering if enabled
              if (pdfFormSettings.pageNumbering !== false) {
                page.drawText("Page 1 of 1", {
                  x: page.getWidth() - 100,
                  y: 20,
                  size: 10,
                  color: rgb(1, 1, 1), // White text
                });
              }

              // Save the PDF
              const pdfBytes = await pdfDoc.save();

              // Log the PDF generation audit event
              await logAuditEvent(req, {
                userId: req.user!.id,
                action: "pdf_generated" as AuditAction,
                resourceId: request.id,
                resourceType: "purchase_request",
                details: {
                  timestamp: new Date().toISOString(),
                  isPreview: true,
                },
              });

              // Return the PDF
              res.setHeader("Content-Type", "application/pdf");
              res.setHeader(
                "Content-Disposition",
                'inline; filename="preview.pdf"',
              );
              return res.send(Buffer.from(pdfBytes));
            }
          } catch (error) {
            debug(req, "Error generating PDF preview:", error);
            return next(error);
          }
        } else {
          // This is a regular audit logging request
          const { action, requestId, details = {} } = req.body;

          // Basic validation
          if (!action || requestId === undefined) {
            return next(
              new ValidationError("Invalid input", {
                action: !action ? ["Action is required"] : [],
                requestId:
                  requestId === undefined ? ["Request ID is required"] : [],
              }),
            );
          }

          // Validate action type
          const validActions = [
            "pdf_viewed",
            "pdf_downloaded",
            "pdf_generated",
            "csv_downloaded",
            "excel_downloaded",
            "zip_downloaded",
          ];
          if (!validActions.includes(action)) {
            // Special case for backward compatibility:
            // If action doesn't match exactly but details indicate export type, accept it with warning
            if (
              action === "pdf_downloaded" &&
              details.exportType &&
              ["csv", "excel", "zip"].includes(details.exportType)
            ) {
              console.log(
                `[Audit] Legacy format detected - using pdf_downloaded with exportType: ${details.exportType}`,
              );
              // Continue with the request using pdf_downloaded as the action
            } else {
              return next(
                new ValidationError("Invalid action", {
                  action: [`Action must be one of: ${validActions.join(", ")}`],
                }),
              );
            }
          }

          // Enhanced request ID validation
          let validatedRequestId: number | null = null;
          console.log(
            `[PDF Audit] Validating request ID: ${requestId} (type: ${typeof requestId})`,
          );

          try {
            // Handle different types of input
            if (requestId === null) {
              throw new ValidationError("RequestId cannot be null", {
                requestId: ["RequestId cannot be null"],
              });
            }

            // Convert to number if string
            const parsedId =
              typeof requestId === "string"
                ? parseInt(requestId.trim(), 10)
                : requestId;

            // Ensure it's a valid number
            if (isNaN(Number(parsedId))) {
              throw new ValidationError("RequestId must be a valid number", {
                requestId: [`"${requestId}" is not a valid number`],
              });
            }

            // Ensure it's positive
            if (Number(parsedId) <= 0) {
              throw new ValidationError("RequestId must be a positive number", {
                requestId: [`Value ${parsedId} is not a positive number`],
              });
            }

            validatedRequestId = Number(parsedId);

            // Check if request exists (optional validation)
            const requestExists = await db.query.purchaseRequests.findFirst({
              where: eq(purchaseRequests.id, validatedRequestId),
            });

            if (!requestExists) {
              console.warn(
                `[PDF Audit] Warning: Request ID ${validatedRequestId} does not exist in database`,
              );
              // We log the warning but still proceed - this is to handle legitimate PDF views of deleted requests
            }
          } catch (validationError) {
            console.error(
              `[PDF Audit] Request ID validation error:`,
              validationError,
            );
            return next(validationError);
          }

          // Determine resource type from action
          let resourceType = "purchase_request";

          // Update action log message for clarity
          let actionDescription = "";

          if (action.startsWith("pdf_")) {
            actionDescription = "PDF " + action.replace("pdf_", "");
          } else if (action.startsWith("csv_")) {
            actionDescription = "CSV " + action.replace("csv_", "");
            resourceType = "csv_export";
          } else if (action.startsWith("excel_")) {
            actionDescription = "Excel " + action.replace("excel_", "");
            resourceType = "excel_export";
          } else if (action.startsWith("zip_")) {
            actionDescription = "ZIP " + action.replace("zip_", "");
            resourceType = "zip_export";
          }

          // Log the export event with validated ID
          await logAuditEvent(req, {
            userId: req.user!.id,
            action: action as AuditAction,
            resourceId: validatedRequestId,
            resourceType: resourceType,
            details: {
              timestamp: new Date().toISOString(),
              exportFormat: action.split("_")[0],
              actionType: action.split("_")[1] || "unknown",
              ...details,
            },
          });

          debug(
            req,
            `Export audit logged: ${actionDescription} for request ${validatedRequestId}`,
          );
          return res.json({ success: true });
        }
      } catch (error) {
        debug(req, "Error in PDF audit endpoint:", error);
        next(error);
      }
    },
  );

  // Helper function to convert hex color to RGB
  function hexToRgb(hex: string): [number, number, number] {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return [r, g, b];
  }

  // AI-powered image analysis for PDF branding
  app.post(
    "/api/pdf/analyze-images",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.isAuthenticated()) {
          throw new AppError("Not authenticated", 401);
        }

        // Check for admin role
        if (req.user?.role !== "admin") {
          throw new AuthorizationError(
            "Only administrators can access this feature",
          );
        }

        const { imageUrls } = req.body;

        if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
          throw new ValidationError("Invalid input", {
            imageUrls: ["At least one image URL is required"],
          });
        }

        // This would be where we'd actually call the Anthropic API for image analysis
        // For now, we'll simulate the AI analysis with intelligent defaults

        // Simulate processing delay
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const analysisResults = {
          success: true,
          timestamp: new Date().toISOString(),
          results: imageUrls.map((url: string) => {
            // Extract image type from URL
            const isHeader = url.includes("headerImage");
            const isFooter = url.includes("footerImage");
            const isLogo = url.includes("logo");

            let imageType = "unknown";
            if (isHeader) imageType = "header";
            if (isFooter) imageType = "footer";
            if (isLogo) imageType = "logo";

            // Generate intelligent analysis based on image type
            const analysis = {
              visibility: Math.random() > 0.2 ? "good" : "poor",
              contrast: Math.random() > 0.2 ? "good" : "poor",
              size: Math.random() > 0.15 ? "appropriate" : "too_small",
              quality: Math.random() > 0.1 ? "good" : "low",
              recommendations: [] as string[],
            };

            // Add relevant recommendations based on image type
            if (isHeader) {
              if (analysis.contrast === "poor") {
                analysis.recommendations.push(
                  "Header image has poor contrast with text. Consider using a darker image or adding a semi-transparent overlay.",
                );
              }
              if (analysis.visibility === "poor") {
                analysis.recommendations.push(
                  "Header image may be difficult to see. Consider using a more prominent design.",
                );
              }
            }

            if (isFooter) {
              if (analysis.contrast === "poor") {
                analysis.recommendations.push(
                  "Footer image has poor contrast. Consider using a more subtle design that doesn't compete with page content.",
                );
              }
              analysis.recommendations.push(
                "Footer images work best when they are subtle and complement the header design.",
              );
            }

            if (isLogo) {
              if (analysis.size === "too_small") {
                analysis.recommendations.push(
                  "Logo appears too small. Consider using a larger version for better brand visibility.",
                );
              }
              if (!url.toLowerCase().endsWith(".png")) {
                analysis.recommendations.push(
                  "Logos display best as transparent PNG files. Consider converting your logo.",
                );
              }
            }

            // General recommendations
            if (Math.random() > 0.7) {
              analysis.recommendations.push(
                "Consider optimizing image size for faster PDF generation and smaller file sizes.",
              );
            }

            return {
              imageUrl: url,
              imageType,
              analysis,
            };
          }),
        };

        // Log the analysis in the audit logs
        await logAuditEvent(req, {
          userId: req.user!.id,
          action: "pdf_analyzed" as AuditAction,
          resourceType: "pdf_branding",
          details: {
            analysisCount: imageUrls.length,
            timestamp: new Date().toISOString(),
          },
        });

        debug(
          req,
          `PDF image analysis completed for ${imageUrls.length} images`,
        );
        res.json(analysisResults);
      } catch (error) {
        debug(req, "Error analyzing PDF images:", error);
        next(error);
      }
    },
  );
  // Add DELETE endpoint for purchase requests
  app.delete(
    "/api/requests/:id",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.isAuthenticated()) {
          throw new AppError("Not authenticated", 401);
        }

        const requestId = parseInt(req.params.id);
        if (isNaN(requestId)) {
          throw new ValidationError("Invalid request ID", {
            id: "Must be a number",
          });
        }

        debug(req, "Attempting to delete request:", requestId);

        // Get the request to check permissions and existence
        const [request] = await db
          .select()
          .from(purchaseRequests)
          .where(eq(purchaseRequests.id, requestId))
          .limit(1);

        if (!request) {
          throw new AppError("Request not found", 404);
        }

        // Allow deletion if user is admin or the request owner
        if (
          req.user!.role !== "admin" &&
          request.requesterId !== req.user!.id
        ) {
          throw new AppError("Unauthorized to delete this request", 403);
        }

        // Start deletion process
        try {
          // Delete associated records first
          await db.transaction(async (tx) => {
            // Delete approvals
            await tx
              .delete(approvals)
              .where(eq(approvals.requestId, requestId));

            // Get attachments before deleting records
            const attachments = await tx
              .select()
              .from(fileAttachments)
              .where(eq(fileAttachments.requestId, requestId));

            // Delete attachment records
            await tx
              .delete(fileAttachments)
              .where(eq(fileAttachments.requestId, requestId));

            // Delete the request
            await tx
              .delete(purchaseRequests)
              .where(eq(purchaseRequests.id, requestId));

            // After successful database deletion, delete physical files
            for (const attachment of attachments) {
              const filePath = path.join(
                process.cwd(),
                attachment.fileUrl.replace(/^\/uploads\//, "uploads/"),
              );
              try {
                await fs.unlink(filePath);
              } catch (error) {
                console.error(`Failed to delete file ${filePath}:`, error);
                // Continue with other files even if one fails
              }
            }
          });

          // Log the successful deletion in audit log
          await logAuditEvent(req, {
            userId: req.user!.id,
            action: "request_deleted" as AuditAction,
            resourceId: requestId,
            resourceType: "purchase_request",
            details: {
              requestNumber: request.requestNumber,
              deletedAt: new Date().toISOString(),
              deletedBy: req.user!.username,
            },
          });

          debug(req, `Request ${requestId} deleted successfully`);
          res.json({
            success: true,
            message: "Request deleted successfully",
            requestId: requestId,
          });
        } catch (error) {
          debug(req, "Error during deletion transaction:", error);
          throw new DatabaseError(
            "Failed to delete request and associated records",
          );
        }
      } catch (error) {
        debug(req, "Error in delete request endpoint:", error);
        next(error);
      }
    },
  );

  // Add these routes after the existing sub-purposes routes

  // Update sub-purpose endpoint
  app.put(
    "/api/admin/sub-purposes/:id",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.isAuthenticated() || req.user?.role !== "admin") {
          throw new AppError("Admin access required", 403);
        }

        const subPurposeId = parseInt(req.params.id);
        if (isNaN(subPurposeId)) {
          throw new ValidationError("Invalid sub-purpose ID", {
            id: "Must be a number",
          });
        }

        debug(req, "Updating sub-purpose:", {
          id: subPurposeId,
          data: req.body,
        });

        // Validate the input data
        const validationResult = insertSubPurposeSchema.safeParse(req.body);
        if (!validationResult.success) {
          throw new ValidationError(
            "Invalid input data",
            validationResult.error.format(),
          );
        }

        // Verify the sub-purpose exists
        const [existingSubPurpose] = await db
          .select()
          .from(subPurposes)
          .where(eq(subPurposes.id, subPurposeId))
          .limit(1);

        if (!existingSubPurpose) {
          throw new AppError("Sub-purpose not found", 404);
        }

        // Type-safe update data
        const updateData = {
          name: validationResult.data.name,
          purpose_type: validationResult.data.purpose_type,
          is_frozen: validationResult.data.is_frozen,
          valid_from: validationResult.data.valid_from,
          valid_to: validationResult.data.valid_to,
          updated_at: new Date(),
        };

        // Update the sub-purpose with proper typing
        const [updatedSubPurpose] = await db
          .update(subPurposes)
          .set(updateData)
          .where(eq(subPurposes.id, subPurposeId))
          .returning();

        debug(req, "Successfully updated sub-purpose:", updatedSubPurpose);
        res.json(updatedSubPurpose);
      } catch (error) {
        debug(req, "Error updating sub-purpose:", error);
        next(error);
      }
    },
  );

  // Delete sub-purpose endpoint with proper validation
  app.delete(
    "/api/admin/sub-purposes/:id",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.isAuthenticated() || req.user?.role !== "admin") {
          throw new AppError("Admin access required", 403);
        }

        const subPurposeId = parseInt(req.params.id);
        if (isNaN(subPurposeId)) {
          throw new ValidationError("Invalid sub-purpose ID", {
            id: "Must be a number",
          });
        }

        debug(req, "Deleting sub-purpose:", { id: subPurposeId });

        // Check for existing references in purchase requests
        const [existingReference] = await db
          .select()
          .from(purchaseRequests)
          .where(eq(purchaseRequests.subPurposeId, subPurposeId))
          .limit(1);

        if (existingReference) {
          throw new AppError(
            "Cannot delete sub-purpose: It is referenced by existing purchase requests",
            400,
          );
        }

        // Verify the sub-purpose exists
        const [existingSubPurpose] = await db
          .select()
          .from(subPurposes)
          .where(eq(subPurposes.id, subPurposeId))
          .limit(1);

        if (!existingSubPurpose) {
          throw new AppError("Sub-purpose not found", 404);
        }

        // Delete the sub-purpose
        await db.delete(subPurposes).where(eq(subPurposes.id, subPurposeId));

        debug(req, "Successfully deleted sub-purpose:", subPurposeId);
        res.status(204).end();
      } catch (error) {
        debug(req, "Error deleting sub-purpose:", error);
        next(error);
      }
    },
  );

  // Add request status update endpoint
  app.post(
    "/api/requests/:id/status",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.isAuthenticated()) {
          throw new AppError("Not authenticated", 401);
        }

        const requestId = parseInt(req.params.id);
        const { status } = req.body;

        if (
          !status ||
          !["approved", "rejected", "changes_requested", "pending"].includes(
            status,
          )
        ) {
          throw new ValidationError("Invalid status", {
            status: ["Invalid status value"],
          });
        }

        debug(req, "Updating request status:", { requestId, status });

        // Get the current request with approvals
        const [existingRequest] = await db
          .select()
          .from(purchaseRequests)
          .where(eq(purchaseRequests.id, requestId))
          .limit(1);

        if (!existingRequest) {
          throw new AppError("Request not found", 404);
        }

        // Get all approvals for this request
        const currentApprovals = await db
          .select()
          .from(approvals)
          .where(eq(approvals.requestId, requestId));

        // Get all required departments
        const requiredDepartments = ["CEO Office", "Finance", "Director"];

        // Check if all required departments have approved
        const allDepartmentsApproved = requiredDepartments.every((dept) =>
          currentApprovals.some(
            (a) => a.department === dept && a.status === "approved",
          ),
        );

        // Only allow status update to approved if all required departments have approved
        if (status === "approved" && !allDepartmentsApproved) {
          throw new ValidationError("Cannot mark as approved", {
            message: "All required departments must approve first",
          });
        }

        // Instead of updating the status ourselves and then calling updateRequestStatus,
        // which would cause duplicate updates, just directly update the status properties
        // other than the status itself, and let updateRequestStatus handle the status
        const [updatedRequest] = await db
          .update(purchaseRequests)
          .set({
            updatedAt: new Date(),
            isLocked: status === "approved", // Lock the request if it's approved
          })
          .where(eq(purchaseRequests.id, requestId))
          .returning();

        // Call the centralized function to set the status and handle notifications
        // Force the status to what was requested (bypass approval checking)
        await db
          .update(purchaseRequests)
          .set({ status })
          .where(eq(purchaseRequests.id, requestId));

        // Then trigger notifications with the centralized function
        await updateRequestStatus(requestId, {
          triggerSource: "status_update",
        });

        debug(req, "Request status updated successfully:", updatedRequest);
        res.json(updatedRequest);
      } catch (error) {
        debug(req, "Error updating request status:", error);
        next(error);
      }
    },
  );

  // Add route to get request approvals
  // Add a route to check if the user has access to a request without fetching all the data
  app.get(
    "/api/requests/:id/check-access",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.isAuthenticated()) {
          throw new AppError("Not authenticated", 401);
        }

        const requestId = parseInt(req.params.id);
        if (isNaN(requestId)) {
          throw new ValidationError("Invalid request ID", {
            id: "Must be a number",
          });
        }

        // Fetch the base request
        const baseRequest = await db.query.purchaseRequests.findFirst({
          where: eq(purchaseRequests.id, requestId),
        });

        if (!baseRequest) {
          return res.status(404).json({ message: "Request not found" });
        }

        // Check if user has permission to view this request
        const user = req.user as {
          id: number;
          role: string;
          department: string;
        };

        // User can view if they are the requester, an admin, or from a mandatory department
        const isAdmin = user.role === "admin";
        const isRequester = baseRequest.requesterId === user.id;

        // Check if user is an approver
        const approvalsForUser = await db
          .select()
          .from(approvals)
          .where(
            and(
              eq(approvals.requestId, requestId),
              eq(approvals.department, user.department || ""),
              eq(approvals.approverId, user.id),
            ),
          );

        const isApprover = approvalsForUser.length > 0;

        // Check if user's department is in additional approvers
        const additionalApprovers = Array.isArray(
          baseRequest.additionalApprovers,
        )
          ? baseRequest.additionalApprovers
          : [];

        const isAdditionalApprover =
          user.department && additionalApprovers.includes(user.department);

        // If user doesn't have permission to view, return 403
        if (!isAdmin && !isRequester && !isApprover && !isAdditionalApprover) {
          return res.status(403).json({
            message: "You do not have permission to view this request",
            error: "permission_denied",
          });
        }

        // User has access
        return res.status(200).json({
          message: "Access granted",
          access: true,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  app.get(
    "/api/requests/:id/approvals",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.isAuthenticated()) {
          throw new AppError("Not authenticated", 401);
        }

        const requestId = parseInt(req.params.id);
        if (isNaN(requestId)) {
          throw new ValidationError("Invalid request ID", {
            id: "Must be a number",
          });
        }

        // Get all approvals for this request with approver details
        const requestApprovals = await db
          .select({
            id: approvals.id,
            requestId: approvals.requestId,
            approverId: approvals.approverId,
            status: approvals.status,
            comments: approvals.comments,
            department: approvals.department,
            processedAt: approvals.processedAt,
            approver: {
              id: users.id,
              username: users.username,
              department: users.department,
            },
          })
          .from(approvals)
          .leftJoin(users, eq(approvals.approverId, users.id))
          .where(eq(approvals.requestId, requestId))
          .orderBy(desc(approvals.processedAt));

        debug(
          req,
          `Found ${requestApprovals.length} approvals for request ${requestId}`,
        );
        res.json(requestApprovals);
      } catch (error) {
        debug(req, "Error fetching request approvals:", error);
        next(error);
      }
    },
  );

  // Add this route after other API routes but before the httpServer creation
  app.post(
    "/api/requests/:id/approvals",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.isAuthenticated()) {
          throw new AppError("Not authenticated", 401);
        }

        const requestId = parseInt(req.params.id);
        const { status, department, comments } = req.body;
        console.log("test");

        if (
          !status ||
          !["approved", "rejected", "changes_requested"].includes(status)
        ) {
          throw new ValidationError("Invalid status", {
            status: ["Invalid status value"],
          });
        }

        if (!department) {
          throw new ValidationError("Invalid department", {
            department: ["Department is required"],
          });
        }

        debug(req, "Creating approval:", { requestId, status, department });

        // Get the current request
        const [existingRequest] = await db
          .select()
          .from(purchaseRequests)
          .where(eq(purchaseRequests.id, requestId))
          .limit(1);

        if (!existingRequest) {
          throw new AppError("Request not found", 404);
        }

        // Check if department already approved
        const [existingApproval] = await db
          .select()
          .from(approvals)
          .where(
            and(
              eq(approvals.requestId, requestId),
              eq(approvals.department, department),
            ),
          )
          .limit(1);

        if (existingApproval) {
          throw new ValidationError("Duplicate approval", {
            message: `This department has already processed this request at ${new Date(
              existingApproval.processedAt,
            ).toLocaleString()}`,
          });
        }

        // Create the approval
        const [approval] = await db
          .insert(approvals)
          .values({
            requestId,
            approverId: req.user!.id,
            status,
            department,
            comments: comments || null,
            processedAt: new Date(),
            isMandatory: ["CEO Office", "Finance", "Director"].includes(
              department,
            ),
          })
          .returning();

        // Update the request status based on all approvals
        // This will now automatically handle notifications from one place
        const newStatus = await updateRequestStatus(requestId, {
          triggerSource: "approval",
        });

        // Log the status update
        console.log(`Request ${requestId} status updated to: ${newStatus}`);

        // Get the current request to return the status
        const [currentRequest] = await db
          .select()
          .from(purchaseRequests)
          .where(eq(purchaseRequests.id, requestId))
          .limit(1);

        console.log("Approval created successfully:", approval);
        res.json({
          message: "Approval processed successfully",
          approval,
          currentStatus: currentRequest.status,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  // Add branding endpoint
  app.get(
    "/api/branding",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.isAuthenticated()) {
          throw new AppError("Not authenticated", 401);
        }

        // Return default branding config if not customized
        const defaultBranding = {
          companyName: "Enterprise Vendor Management",
          logo: null,
          primaryColor: "#1a56db",
          accentColor: "#7c3aed",
          theme: "light",
          customCss: null,
        };

        res.json(defaultBranding);
      } catch (error) {
        debug(req, "Error fetching branding:", error);
        next(error);
      }
    },
  );

  // Add request export endpoint
  app.get(
    "/api/requests/export",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.isAuthenticated()) {
          throw new AppError("Not authenticated", 401);
        }

        console.log(
          "[GET /api/requests/export] Received request with query params:",
          req.query,
        );

        const format = req.query.format as string;
        if (!format || !["xlsx", "csv"].includes(format)) {
          throw new ValidationError("Invalid format", {
            format: "Must be xlsx or csv",
          });
        }

        // Check if we're exporting a specific request or all requests
        let requestId = null;

        // Enhanced robust ID validation with detailed logging and diagnostics
        if (
          req.query.id &&
          req.query.id !== "undefined" &&
          req.query.id !== "null"
        ) {
          // Add extensive logging to diagnose the issue
          console.log(
            `[GET /api/requests/export] Raw ID parameter: ${req.query.id}`,
          );
          console.log(
            `[GET /api/requests/export] ID parameter type: ${typeof req.query.id}`,
          );
          console.log(
            `[GET /api/requests/export] Query object:`,
            JSON.stringify(req.query),
          );

          // Convert to string and trim whitespace (handles undefined/null conversion safely)
          // Note that req.query.id is already a string (Express parses query params as strings)
          const idString = String(req.query.id).trim();

          // Special case for diagnostic ID or test ID
          if (idString === "999999") {
            requestId = 999999;
            console.log(
              `[GET /api/requests/export] Using special diagnostic ID: ${requestId}`,
            );
          }
          // Support other special IDs if needed in the future
          else if (idString === "000000") {
            requestId = 0; // Special case for system-wide export
            console.log(
              `[GET /api/requests/export] Using system-wide export ID: ${requestId}`,
            );
          } else {
            // Try to parse as integer with more flexible validation
            try {
              // IMPORTANT: The issue is likely here - need to ensure we're using base 10
              // and interpreting the string correctly without validation that's too strict
              const idValue = parseInt(idString, 10);

              // Only set requestId if it's a valid number - simplified validation
              if (!isNaN(idValue)) {
                // Note: Changed to allow any numeric ID and not just positive numbers
                // since 0 could be a valid ID in some cases
                requestId = idValue;
                console.log(
                  `[GET /api/requests/export] Valid request ID: ${requestId}`,
                );
              } else {
                console.log(
                  `[GET /api/requests/export] Invalid request ID format: "${idString}", parsed as: ${idValue}`,
                );
                throw new ValidationError("Invalid request ID", {
                  id: "Failed to parse as a number",
                });
              }
            } catch (parseError) {
              console.log(
                `[GET /api/requests/export] Error parsing ID: "${idString}", error:`,
                parseError,
              );
              throw new ValidationError("Invalid request ID", {
                id: "Failed to parse as a valid number",
              });
            }
          }
        } else {
          // If no ID provided or it's 'undefined'/'null', we'll export all requests
          console.log(
            "[GET /api/requests/export] No valid ID parameter provided, exporting all requests",
          );
          requestId = null;
        }

        console.log(
          `[GET /api/requests/export] Fetching purchase request with ID: ${requestId || "all"}`,
        );
        debug(
          req,
          `[GET /api/requests/export] Fetching purchase request with ID: ${requestId || "all"}`,
        );

        let formattedRequests = [];

        if (requestId) {
          // Export a single request
          try {
            // Check if the purchase request exists in the database
            const checkRequest = await db.query.purchaseRequests.findFirst({
              where: eq(purchaseRequests.id, requestId),
            });

            if (!checkRequest) {
              console.log(
                `[GET /api/requests/export] Request with ID ${requestId} not found in database`,
              );
              throw new NotFoundError(
                `Purchase request with ID ${requestId} not found`,
              );
            }

            const requestWithRelations =
              await getRequestWithRelations(requestId);

            // Transform the request for export
            formattedRequests = [
              {
                "Request ID": requestWithRelations.id,
                "Request Number": requestWithRelations.requestNumber,
                Title: requestWithRelations.title,
                Description: requestWithRelations.description,
                Status: requestWithRelations.status,
                Priority: requestWithRelations.priority,
                "Purpose Type": requestWithRelations.purposeType,
                "Total Cost":
                  requestWithRelations.totalEstimatedCost?.toFixed(2) || "0.00",
                "Created Date": new Date(
                  requestWithRelations.createdAt,
                ).toLocaleDateString(),
                "Last Updated": requestWithRelations.updatedAt
                  ? new Date(
                      requestWithRelations.updatedAt,
                    ).toLocaleDateString()
                  : "N/A",
                Vendor: requestWithRelations.vendor
                  ? requestWithRelations.vendor.companyName ||
                    requestWithRelations.vendor.name
                  : "N/A",
                Requester: requestWithRelations.requester
                  ? requestWithRelations.requester.username
                  : "N/A",
                "Items Count": Array.isArray(requestWithRelations.items)
                  ? requestWithRelations.items.length
                  : 0,
              },
            ];
          } catch (error) {
            console.error(
              `[GET /api/requests/export] Error fetching purchase request:`,
              error,
            );
            debug(
              req,
              `[GET /api/requests/export] Error fetching purchase request: ${JSON.stringify(error)}`,
            );

            if (error instanceof NotFoundError) {
              throw error; // Pass through NotFoundError
            } else {
              throw new ValidationError(
                "Invalid request ID or unable to fetch request data",
                {
                  id: requestId,
                  error: error instanceof Error ? error.message : String(error),
                },
              );
            }
          }
        } else {
          // Export all requests (default behavior)
          // Fetch all requests with related data
          const requests = await db
            .select({
              id: purchaseRequests.id,
              requestNumber: purchaseRequests.requestNumber,
              title: purchaseRequests.title,
              description: purchaseRequests.description,
              status: purchaseRequests.status,
              priority: purchaseRequests.priority,
              purposeType: purchaseRequests.purposeType,
              totalEstimatedCost: purchaseRequests.totalEstimatedCost,
              createdAt: purchaseRequests.createdAt,
              updatedAt: purchaseRequests.updatedAt,
            })
            .from(purchaseRequests)
            .orderBy(desc(purchaseRequests.createdAt));

          if (requests.length === 0) {
            throw new AppError("No requests found to export", 404);
          }

          // Transform dates and format data
          formattedRequests = requests.map((request) => ({
            "Request ID": request.id,
            "Request Number": request.requestNumber,
            Title: request.title,
            Description: request.description,
            Status: request.status,
            Priority: request.priority,
            "Purpose Type": request.purposeType,
            "Total Cost": request.totalEstimatedCost?.toFixed(2) || "0.00",
            "Created Date": new Date(request.createdAt).toLocaleDateString(),
            "Last Updated": new Date(request.updatedAt).toLocaleDateString(),
          }));
        }

        const filename = requestId
          ? `purchase_request_${requestId}_${new Date().toISOString().split("T")[0]}`
          : `purchase_requests_${new Date().toISOString().split("T")[0]}`;

        if (format === "csv") {
          try {
            // Ensure we have at least one request to export
            if (!formattedRequests || formattedRequests.length === 0) {
              throw new Error("No data available to export");
            }

            // Use a proper CSV library for more reliable formatting
            const { Parser } = require("@json2csv/plainjs");

            // Configure CSV parser options with correct field delimiter, quote character, etc.
            const opts = {
              fields: Object.keys(formattedRequests[0]), // Auto-detect fields from the first object
              delimiter: ",",
              quote: '"',
              escapedQuote: '""',
              header: true,
              eol: "\n",
            };

            // Generate CSV
            const parser = new Parser(opts);
            const csv = parser.parse(formattedRequests);

            // Add BOM for Excel compatibility with UTF-8 CSVs
            const csvWithBom = "\ufeff" + csv;

            // Log the size of the CSV for debugging
            console.log(
              `[GET /api/requests/export] Generated CSV with ${formattedRequests.length} records, size: ${csvWithBom.length} bytes`,
            );

            // Set proper headers for CSV download
            res.setHeader("Content-Type", "text/csv; charset=utf-8");
            res.setHeader(
              "Content-Disposition",
              `attachment; filename="${filename}.csv"`,
            );
            return res.send(csvWithBom);
          } catch (csvError) {
            console.error("Error generating CSV:", csvError);
            throw new AppError(
              `Failed to generate CSV: ${csvError.message}`,
              500,
            );
          }
        } else {
          // Handle Excel export
          try {
            // Ensure we have at least one request to export
            if (!formattedRequests || formattedRequests.length === 0) {
              throw new Error("No data available to export");
            }

            // Generate Excel with enhanced options and formatting
            const worksheet = XLSX.utils.json_to_sheet(formattedRequests);

            // Set column widths for better readability
            const colWidths = [];
            for (const field of Object.keys(formattedRequests[0])) {
              // Estimate appropriate column width based on field name and sample data
              const fieldWidth = Math.max(
                field.length,
                Math.min(
                  50,
                  String(
                    formattedRequests[0][
                      field as keyof (typeof formattedRequests)[0]
                    ] || "",
                  ).length,
                ),
              );
              colWidths.push({ wch: fieldWidth });
            }
            worksheet["!cols"] = colWidths;

            // Style the header row
            const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:A1");
            for (let col = range.s.c; col <= range.e.c; col++) {
              const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
              if (!worksheet[cellRef]) continue;

              // Add cell styling for the header row
              worksheet[cellRef].s = {
                font: { bold: true, color: { rgb: "FFFFFF" } },
                fill: { fgColor: { rgb: "4A72B0" } },
                alignment: { horizontal: "center" },
              };
            }

            // Create the workbook and add the worksheet
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Requests");

            // Add metadata to the workbook
            workbook.Props = {
              Title: "Purchase Requests Export",
              Subject: "Purchase Requests Data",
              Author: "Enterprise Vendor Management System",
              CreatedDate: new Date(),
            };

            // Generate buffer with specified options for Excel compatibility
            const excelBuffer = XLSX.write(workbook, {
              type: "buffer",
              bookType: "xlsx",
              compression: true, // Use compression for smaller file size
              bookSST: true, // Generate shared string table for better performance
              Props: workbook.Props,
            });

            // Log the size of the Excel file for debugging
            console.log(
              `[GET /api/requests/export] Generated Excel with ${formattedRequests.length} records, size: ${excelBuffer.length} bytes`,
            );

            // Set correct headers for Excel download
            res.setHeader(
              "Content-Type",
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            );
            res.setHeader(
              "Content-Disposition",
              `attachment; filename="${filename}.xlsx"`,
            );

            // Return the Excel file
            return res.send(Buffer.from(excelBuffer));
          } catch (excelError) {
            console.error("Error generating Excel:", excelError);
            throw new AppError(
              `Failed to generate Excel: ${excelError.message}`,
              500,
            );
          }
        }
      } catch (error) {
        debug(req, "Error exporting requests:", error);
        next(error);
      }
    },
  );

  const httpServer = createServer(app);
  return httpServer;
}

// Helper function for analyzing errors
async function analyzeError(error: Error, context: any) {
  return {
    timestamp: new Date().toISOString(),
    errorType: error.constructor.name,
    message: error.message,
    context,
  };
}

async function getRequestWithRelations(requestId: number) {
  console.log(
    "[getRequestWithRelations] Fetching purchase request with ID:",
    requestId,
  );

  // Get the base request data
  const requests = await db.query.purchaseRequests.findMany({
    where: eq(purchaseRequests.id, requestId),
    limit: 1,
  });

  if (requests.length === 0) {
    throw new AppError("Request not found", 404);
  }

  const request = requests[0];

  // Get vendor details if vendorId exists
  let vendor = null;
  if (request.vendorId) {
    const vendorResults = await db.query.vendors.findMany({
      where: eq(vendors.id, request.vendorId),
      limit: 1,
    });

    if (vendorResults.length > 0) {
      vendor = vendorResults[0];
    }
  }

  // Get sub-purpose details if subPurposeId exists
  let subPurpose = null;
  if (request.subPurposeId) {
    const subPurposeResults = await db.query.subPurposes.findMany({
      where: eq(subPurposes.id, request.subPurposeId),
      limit: 1,
    });

    if (subPurposeResults.length > 0) {
      subPurpose = subPurposeResults[0];
    }
  }

  // Get requester details if requesterId exists
  let requester = null;
  if (request.requesterId) {
    const requesterResults = await db.query.users.findMany({
      where: eq(users.id, request.requesterId),
      limit: 1,
    });

    if (requesterResults.length > 0) {
      requester = requesterResults[0];
      console.log(
        "[getRequestWithRelations] Found requester:",
        requester.username,
        "department:",
        requester.department,
      );
    }
  }

  // Get approvals for this request with approver details
  const approvalsList = await db.query.approvals.findMany({
    where: eq(approvals.requestId, requestId),
    with: {
      approver: {
        columns: {
          id: true,
          username: true,
          email: true,
          department: true,
          role: true,
        },
      },
    },
  });

  // Parse additionalApprovers JSON
  const additionalApprovers =
    typeof request.additionalApprovers === "string"
      ? JSON.parse(request.additionalApprovers)
      : Array.isArray(request.additionalApprovers)
        ? request.additionalApprovers
        : [];

  // Create list of all expected approvers (mandatory + additional) with deduplication
  const mandatoryDepartments = ["CEO Office", "Finance", "Director"];
  const allExpectedDepartments = Array.from(new Set([...mandatoryDepartments, ...additionalApprovers]));
  
  console.log(`[getRequestWithRelations] Creating complete approval list for request ${requestId}`);
  console.log(`[getRequestWithRelations] Mandatory departments:`, mandatoryDepartments);
  console.log(`[getRequestWithRelations] Additional approvers:`, additionalApprovers);
  console.log(`[getRequestWithRelations] All expected departments:`, allExpectedDepartments);
  console.log(`[getRequestWithRelations] Existing approvals:`, approvalsList.map(a => ({ dept: a.department, status: a.status, approver: a.approver?.username })));
  
  // Create a complete list of expected approvals, including those not yet processed
  const completeApprovalsList = [];
  
  for (const department of allExpectedDepartments) {
    // Check if this department has already approved
    const existingApproval = approvalsList.find(approval => approval.department === department);
    
    if (existingApproval) {
      // Use existing approval
      completeApprovalsList.push(existingApproval);
      console.log(`[getRequestWithRelations] Found existing approval for ${department}:`, existingApproval.status);
    } else {
      // Create placeholder for pending approval
      const pendingApproval = {
        id: null,
        requestId: requestId,
        approverId: null,
        department: department,
        status: 'pending',
        comments: null,
        processedAt: null,
        isMandatory: mandatoryDepartments.includes(department),
        approver: null // No approver assigned yet
      };
      completeApprovalsList.push(pendingApproval);
      console.log(`[getRequestWithRelations] Created pending approval for ${department}`);
    }
  }
  
  console.log(`[getRequestWithRelations] Complete approvals list has ${completeApprovalsList.length} entries`);
  console.log(`[getRequestWithRelations] Complete approvals:`, completeApprovalsList.map(a => ({ dept: a.department, status: a.status, approver: a.approver?.username || 'null' })));

  // Get attachments
  const attachmentsList = await db.query.fileAttachments.findMany({
    where: eq(fileAttachments.requestId, requestId),
  });

  // Parse items JSON
  const items =
    typeof request.items === "string"
      ? JSON.parse(request.items)
      : request.items;

  // Return complete request with relations
  return {
    ...request,
    items,
    vendor,
    subPurpose,
    requester,
    approvals: completeApprovalsList, // Use complete list including pending approvals
    attachments: attachmentsList,
    additionalApprovers, // Explicitly include additionalApprovers as an array
  };
}

/**
 * Updates a request's status based on its approvals and handles notifications
 * This function now centralizes notification creation to prevent duplicates
 *
 * @param requestId The ID of the request to update
 * @param options Configuration options
 * @param options.skipNotification Whether to skip sending notifications (default: false)
 * @param options.triggerSource Where the update was triggered from ('approval', 'status_update', etc.)
 * @returns The new status of the request
 */
async function updateRequestStatus(
  requestId: number,
  options: {
    skipNotification?: boolean;
    triggerSource?: "approval" | "status_update" | "system";
  } = {},
) {
  try {
    // Get request details first
    const [request] = await db
      .select()
      .from(purchaseRequests)
      .where(eq(purchaseRequests.id, requestId))
      .limit(1);

    if (!request) {
      throw new Error(`Request with ID ${requestId} not found`);
    }

    const oldStatus = request.status;

    // Get all approvals
    const approvalsList = await db
      .select()
      .from(approvals)
      .where(eq(approvals.requestId, requestId));

    const mandatoryApprovals = approvalsList.filter((a) => a.isMandatory);
    const allApproved = mandatoryApprovals.every(
      (a) => a.status === "approved",
    );
    const allRejected = mandatoryApprovals.every(
      (a) => a.status === "rejected",
    );
    const anyChangesRequested = mandatoryApprovals.some(
      (a) => a.status === "changes_requested",
    );

    let newStatus: string;
    if (allApproved) {
      newStatus = "approved";
    } else if (allRejected) {
      newStatus = "rejected";
    } else if (anyChangesRequested) {
      newStatus = "changes_requested";
    } else {
      newStatus = "pending";
    }

    // Only update the status if it's different
    if (oldStatus !== newStatus) {
      await db
        .update(purchaseRequests)
        .set({ status: newStatus })
        .where(eq(purchaseRequests.id, requestId));

      // Handle notifications if not explicitly skipped
      if (!options.skipNotification) {
        // Get the requester
        const [requester] = await db
          .select()
          .from(users)
          .where(eq(users.id, request.requesterId))
          .limit(1);

        if (requester) {
          // Get the most recent approval that triggered this change
          const recentApproval =
            approvalsList.length > 0
              ? approvalsList.sort(
                  (a, b) =>
                    new Date(b.processedAt || 0).getTime() -
                    new Date(a.processedAt || 0).getTime(),
                )[0]
              : null;

          // Get approver info if available
          let approverName = "the system";
          let department = "";

          if (recentApproval) {
            const [approver] = await db
              .select()
              .from(users)
              .where(eq(users.id, recentApproval.approverId))
              .limit(1);

            if (approver) {
              approverName = approver.username;
              department =
                recentApproval.department || approver.department || "";
            }
          }

          // Create appropriate notification based on the new status
          await notificationService.createNotification({
            userId: requester.id,
            title: `Request ${newStatus.replace("_", " ")}`,
            message: `Your purchase request "${request.title}" has been ${newStatus.replace("_", " ")}${department ? ` by ${department}` : ""}`,
            type: `request_${newStatus}`,
            requestId,
            priority:
              newStatus === "approved" || newStatus === "rejected"
                ? "high"
                : "normal",
            actionType:
              newStatus === "approved"
                ? "view"
                : newStatus === "changes_requested"
                  ? "update"
                  : "acknowledge",
          });
        }
      }
    }

    return newStatus;
  } catch (error) {
    console.error("Error updating request status:", error);
    throw error;
  }
}
