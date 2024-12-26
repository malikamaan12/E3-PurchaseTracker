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

(async () => {
  try {
    // Test database connection first with retries
    log("Testing database connection...");
    const maxRetries = 3;
    let connectionEstablished = false;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const isConnected = await testConnection();
        if (isConnected) {
          connectionEstablished = true;
          log("Database connection established successfully");
          break;
        }
      } catch (err: any) {
        lastError = err;
        log(`Connection attempt ${attempt} failed: ${err.message}`);

        if (attempt < maxRetries) {
          const delay = 2000 * attempt; // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    if (!connectionEstablished) {
      throw new Error(`Failed to connect to database after ${maxRetries} attempts. Last error: ${lastError?.message}`);
    }

    // Initialize Anthropic client (non-blocking)
    const anthropicClient = initializeAnthropicClient();
    if (!anthropicClient) {
      log("Warning: Anthropic client initialization failed. Some features may be limited.");
    }

    // Set up authentication
    await setupAuth(app);

    // Set up routes
    const server = await registerRoutes(app);

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
    } else {
      serveStatic(app);
    }

    // Start the server with proper error handling
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, "0.0.0.0", () => {
      log(`Server started and listening on port ${PORT}`);
    }).on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        log(`Port ${PORT} is in use, trying ${PORT + 1}`);
        server.listen(PORT + 1, "0.0.0.0");
      } else {
        console.error('Server error:', err);
      }
    });
  } catch (error: any) {
    console.error('Fatal server error:', error);
    process.exit(1);
  }
})();