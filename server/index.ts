import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { testConnection } from "@db";
import Anthropic from '@anthropic-ai/sdk';

// the newest Anthropic model is "claude-3-5-sonnet-20241022" which was released October 22, 2024
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function analyzeServerError(error: Error): Promise<string> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: `Analyze this server error and provide a clear, user-friendly explanation of what might be wrong and how to fix it. Error: ${error.message}`
      }]
    });

    const content = response.content[0];
    return content.type === 'text' 
      ? content.text 
      : "An unexpected server error occurred. Please check the logs for more details.";
  } catch (anthropicError) {
    console.error("Error analyzing server error:", anthropicError);
    return error.message;
  }
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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
    // Test database connection before starting server
    const maxRetries = 3;
    let connectionEstablished = false;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        log(`Database connection attempt ${attempt}/${maxRetries}...`);
        const isConnected = await testConnection();
        if (isConnected) {
          connectionEstablished = true;
          log("Database connection established successfully");
          break;
        }
      } catch (err: any) {
        lastError = err;
        log(`Connection attempt ${attempt} failed: ${err.message}`);

        if (err.message.includes('endpoint is disabled')) {
          log(`
Database endpoint is disabled. To fix this:
1. Go to https://console.neon.tech/app/projects
2. Select your project
3. Click on "Branches" in the left sidebar
4. Find your branch and enable the compute endpoint
`);
          break; // Don't retry if endpoint is disabled
        }

        if (attempt < maxRetries) {
          const delay = 2000 * attempt; // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    if (!connectionEstablished) {
      const analysis = await analyzeServerError(lastError!);
      throw new Error(`Failed to connect to database: ${analysis}`);
    }

    // Set up routes and get the HTTP server instance
    const server = await registerRoutes(app);

    // Global error handler with AI-powered analysis
    app.use(async (err: any, _req: Request, res: Response, _next: NextFunction) => {
      console.error('Global error handler caught:', err);
      const status = err.status || err.statusCode || 500;
      const message = await analyzeServerError(err);

      res.status(status).json({ message });
    });

    // Setup vite in development or serve static files in production
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Start the server
    const PORT = 5000;
    server.listen(PORT, "0.0.0.0", () => {
      log(`Server started and listening on port ${PORT}`);
    });
  } catch (error: any) {
    console.error('Fatal server error:', await analyzeServerError(error));
    process.exit(1);
  }
})();