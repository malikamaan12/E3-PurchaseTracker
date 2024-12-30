import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { db } from "@db";
import fs from 'fs';
import path from 'path';
import { AppError, handleError } from './utils/errors';
import session from "express-session";
import createMemoryStore from "memorystore";
import { sql } from 'drizzle-orm';
import { setupAuth } from './auth';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { IncomingMessage } from 'http';

// Initialize express app
const app = express();

// Enhanced middleware setup
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

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

    // Create HTTP server
    const httpServer = createServer(app);

    // Set up WebSocket server with proper error handling
    const wss = new WebSocketServer({ 
      server: httpServer,
      handleProtocols: (protocols: Set<string>, _request: IncomingMessage) => {
        // Convert Set to Array for proper protocol handling
        const protocolArray = Array.from(protocols);

        // Check for Vite HMR protocol
        if (protocolArray.includes('vite-hmr')) {
          return false; // Let Vite handle its own HMR
        }

        // Return first available protocol or false if none available
        return protocolArray.length > 0 ? protocolArray[0] : false;
      }
    });

    // WebSocket error handling
    wss.on('error', (error) => {
      console.error('WebSocket server error:', error);
    });

    // Handle connections
    wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      const clientIp = request.socket.remoteAddress;
      log(`New WebSocket connection from ${clientIp}`);

      ws.on('error', (error) => {
        console.error(`WebSocket connection error from ${clientIp}:`, error);
      });

      ws.on('close', () => {
        log(`WebSocket connection closed from ${clientIp}`);
      });
    });

    log("WebSocket server initialized");

    // Set up routes after WebSocket server
    await registerRoutes(app);
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
      await setupVite(app, httpServer);
      log("Vite development server initialized");
    } else {
      serveStatic(app);
      log("Static files serving configured");
    }

    // Start the server
    const port = 5000;
    httpServer.listen(port, "0.0.0.0", () => {
      log(`Server started and listening on port ${port}`);
    });

    // Cleanup handler
    const cleanup = () => {
      log('Shutting down server...');
      httpServer.close(() => {
        log('HTTP server closed');
        wss.close(() => {
          log('WebSocket server closed');
          process.exit(0);
        });
      });
    };

    process.on('SIGTERM', cleanup);
    process.on('SIGINT', cleanup);

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