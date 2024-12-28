import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { testConnection } from "@db";
import { initializeAnthropicClient } from "./utils/anthropic-client";
import { setupAuth } from "./auth";

// Validate required environment variables
const requiredEnvVars = ['DATABASE_URL', 'ANTHROPIC_API_KEY'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

// Initialize express app first
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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

    // Initialize Anthropic client (non-blocking)
    const anthropicClient = await initializeAnthropicClient();
    if (!anthropicClient) {
      log("Warning: Anthropic client initialization failed. Some features may be limited.");
    } else {
      log("Anthropic client initialized successfully");
    }

    // Set up authentication
    await setupAuth(app);
    log("Authentication setup completed");

    // Set up routes
    const server = await registerRoutes(app);
    log("Routes registered successfully");

    // Global error handler
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      console.error('Server error:', err);
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
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
    console.error('Fatal server initialization error:', error);
    process.exit(1);
  }
}

// Start the server
initializeServer().catch(error => {
  console.error('Failed to initialize server:', error);
  process.exit(1);
});