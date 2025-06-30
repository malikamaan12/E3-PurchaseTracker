import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { registerPdfRoutes } from "./routes/pdf-routes";
import { registerUnifiedPdfRoutes } from "./routes/unified-pdf-routes";
import { registerPdfAnalysisRoutes } from "./routes/pdf-analysis-routes";
import { setupVite, serveStatic, log } from "./vite";
import { db } from "@db";
import fs from 'fs';
import path from 'path';
import { AppError, handleError } from './utils/errors';
import session from "express-session";
import createMemoryStore from "memorystore";
import { sql } from 'drizzle-orm';
import { setupAuth } from './auth';

// Initialize express app
const app = express();

// Enhanced middleware setup
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Add host bypass middleware for Vite compatibility
app.use((req, res, next) => {
  // Override host header to bypass Vite's host check
  if (req.headers.host && req.headers.host.includes('replit.dev')) {
    req.headers.host = 'localhost:5000';
  }
  next();
});

// Set default content type for API routes
app.use('/api', (req, res, next) => {
  res.type('application/json');
  next();
});

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Serve static files from the public directory
app.use(express.static(path.join(process.cwd(), 'public')));

// Add detailed request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  // Log request details for debugging
  if (path.startsWith('/api')) {
    console.log('API request received:', {
      method: req.method,
      path: req.path,
      body: req.body,
      query: req.query,
      headers: req.headers
    });
  }

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }
      log(logLine);
    }
  });

  next();
});

// Session setup
const MemoryStore = createMemoryStore(session);
const sessionSettings: session.SessionOptions = {
  secret: process.env.REPL_ID || "secure-session-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: app.get("env") === "production",
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  },
  store: new MemoryStore({
    checkPeriod: 86400000 // prune expired entries every 24h
  })
};

if (app.get("env") === "production") {
  app.set("trust proxy", 1);
}

app.use(session(sessionSettings));

async function initializeServer() {
  try {
    // Test database connection first
    log("Testing database connection...");
    let isConnected = false;
    let retries = 0;
    const maxRetries = 3;

    while (!isConnected && retries < maxRetries) {
      try {
        await db.execute(sql`SELECT 1`);
        isConnected = true;
        log("Database connection established successfully");
      } catch (err) {
        retries++;
        if (retries < maxRetries) {
          log(`Database connection attempt ${retries} failed, retrying in ${retries * 1000}ms...`);
          await new Promise(resolve => setTimeout(resolve, retries * 1000));
        } else {
          throw new Error("Failed to establish database connection after multiple attempts");
        }
      }
    }

    // Set up authentication before routes
    await setupAuth(app);
    log("Authentication setup completed");

    // Set up routes
    const server = registerRoutes(app);
    // Use the new unified PDF routes instead of the old ones
    registerUnifiedPdfRoutes(app);
    // Register AI-powered PDF analysis routes
    registerPdfAnalysisRoutes(app);
    log("Routes registered successfully");

    // Global error handler with proper async handling
    app.use(async (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
      console.error('Server error:', {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined
      });

      const appError = await handleError(err);

      if (!res.headersSent) {
        res.status(appError.status).json({
          error: true,
          message: appError.message,
          severity: appError.severity,
          predictions: appError.predictions || [],  // Include predictions
          suggestions: appError.suggestions || [],  // Include suggestions
          details: app.get('env') === 'development' ? {
            stack: appError.stack,
            ...appError.details
          } : undefined
        });
      }
    });

    // 404 handler for API routes
    app.use('/api/*', (req, res) => {
      const error = new AppError(`API endpoint not found: ${req.path}`, 404, 'warning');
      res.status(404).json({
        error: true,
        message: error.message,
        severity: error.severity
      });
    });

    // Setup vite in development or serve static files in production
    if (app.get("env") === "development") {
      await setupVite(app, server);
      log("Vite development server initialized");
    } else {
      serveStatic(app);
      log("Static files serving configured");
    }

    // Try different ports if the default is in use
    const ports = [5000, 3000, 8080, 4000];
    let serverStarted = false;

    for (const port of ports) {
      try {
        await new Promise((resolve, reject) => {
          server.listen(port, "0.0.0.0")
            .once('listening', () => {
              log(`Server started and listening on port ${port}`);
              serverStarted = true;
              resolve(true);
            })
            .once('error', (err: any) => {
              if (err.code === 'EADDRINUSE') {
                log(`Port ${port} is in use, trying next port...`);
                resolve(false);
              } else {
                reject(err);
              }
            });
        });

        if (serverStarted) break;
      } catch (error: any) {
        log(`Error starting server on port ${port}: ${error.message}`);
        if (port === ports[ports.length - 1]) {
          throw error; // Throw if we've tried all ports
        }
      }
    }

    if (!serverStarted) {
      throw new Error('Failed to start server on any available port');
    }

  } catch (error: any) {
    console.error('Fatal server initialization error:', {
      message: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

// Start the server
initializeServer().catch(error => {
  console.error('Failed to initialize server:', error);
  process.exit(1);
});