import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { testConnection } from "@db";
import { setupAuth } from "./auth";
import fs from 'fs';
import path from 'path';

// Validate required environment variables
const requiredEnvVars = [
  'DATABASE_URL',
  'ANTHROPIC_API_KEY'
];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

// Initialize express app first
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

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

async function initializeServer() {
  try {
    // Test database connection first with retries
    log("Testing database connection...");
    let isConnected = false;
    let retries = 0;
    const maxRetries = 3;

    while (!isConnected && retries < maxRetries) {
      try {
        isConnected = await testConnection();
        if (isConnected) {
          log("Database connection established successfully");
          break;
        }
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

    // Set up authentication
    await setupAuth(app);
    log("Authentication setup completed");

    // Set up routes
    const server = await registerRoutes(app);
    log("Routes registered successfully");

    // Global error handler with improved JSON responses
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      console.error('Server error:', {
        message: err.message,
        stack: err.stack,
        status: err.status || err.statusCode || 500
      });

      // Ensure content type is set to application/json
      res.type('application/json');

      const status = err.status || err.statusCode || 500;
      const errorResponse = {
        error: true,
        message: err.message || "Internal Server Error",
        details: app.get('env') === 'development' ? {
          stack: err.stack,
          ...err
        } : undefined
      };

      res.status(status).json(errorResponse);
    });

    // 404 handler for API routes
    app.use('/api/*', (req, res) => {
      res.status(404).json({
        error: true,
        message: `API endpoint not found: ${req.path}`
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

    // Start the server
    const PORT = Number(process.env.PORT || 5000);
    server.listen(PORT, "0.0.0.0", () => {
      log(`Server started and listening on port ${PORT}`);
    }).on('error', (err: any) => {
      console.error('Failed to start server:', err);
      process.exit(1);
    });

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