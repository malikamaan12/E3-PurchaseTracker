import type { Express } from "express";
import { createServer, type Server } from "http";
import path from "path";
import express from "express";
import fsSync from "fs";
import { debug } from "./utils/debug";

// Modular Routers
import vendorRouter from "./routes/vendor-routes";
import adminRouter from "./routes/admin-routes";
import requestRouter from "./routes/request-routes";
import documentRouter from "./routes/document-routes";
import conversionRouter from "./routes/conversion-routes";
import departmentRouter from "./routes/department-routes";
import { registerNotificationRoutes } from "./routes/notification-routes";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth is already initialized in index.ts — do NOT call setupAuth here again

  // API Router for general logic
  const apiRouter = express.Router();

  // Register domain-specific routes
  registerNotificationRoutes(apiRouter);
  
  // Dynamic import for Claude AI (to keep main bundle light)
  import('./routes/claude-ai-routes').then(({ registerClaudeAIRoutes }) => {
    registerClaudeAIRoutes(apiRouter);
  }).catch(err => {
    console.error('Error loading Claude AI routes:', err);
  });

  // Mount modular routers
  app.use("/api/backend/vendors", vendorRouter);
  app.use("/api/backend/admin", adminRouter);
  app.use("/api/backend/departments", departmentRouter);
  app.use("/api/backend/conversion", conversionRouter);
  app.use("/api/backend", requestRouter);
  app.use("/api/backend", documentRouter);
  app.use("/api/backend", apiRouter);

  // Initialize uploads directory (only for local development)
  if (process.env.NODE_ENV !== 'production') {
    const uploadsDir = path.join(process.cwd(), "uploads");
    if (!fsSync.existsSync(uploadsDir)) {
      fsSync.mkdirSync(uploadsDir, { recursive: true });
    }
    // Serve static files
    app.use("/uploads", express.static(uploadsDir));
  }

  // Catch-all for API 404s
  app.use("/api/backend/*", (req, res) => {
    res.status(404).json({ message: "Not Found on Backend" });
  });

  const httpServer = createServer(app);
  return httpServer;
}
