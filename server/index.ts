import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { createProxyMiddleware } from 'http-proxy-middleware';
import fs from 'fs';
import path from 'path';
import { AppError, handleError } from './utils/errors';
import { setupAuth } from './auth';
import { seedDepartments } from './seed/departments';

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

// Initialize express app
const app = express();

// 1. PROXY MIDDLEWARE (Must be before body parsers in development)
if (app.get("env") === "development") {
  app.use(createProxyMiddleware({
    target: 'http://localhost:3000',
    changeOrigin: true,
    ws: true,
    pathFilter: (pathname: string) => {
      // Only proxy to Next.js if NOT a backend API route or an uploads route
      return !pathname.startsWith('/api/backend') && !pathname.startsWith('/uploads');
    },
    on: {
      error: (err, _req, res: any) => {
        if (res && !res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'text/plain' });
          res.end('Next.js is starting up... Please wait.');
        }
      }
    }
  }));
  console.log("Next.js proxy configured for port 3000");
}

// 2. BODY PARSERS
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 3. INTERNAL MIDDLEWARE
app.use('/api', (req, res, next) => {
  res.type('application/json');
  next();
});

// Create uploads directory
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// 4. LOGGING MIDDLEWARE
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

if (app.get("env") === "production") {
  app.set("trust proxy", 1);
}

async function initializeServer() {
  try {
    // Seed initial departments
    await seedDepartments();

    // Setup Auth and Routes (DB connection validated on first real query)
    await setupAuth(app);
    const server = await registerRoutes(app);

    // Error Handler
    app.use(async (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
      console.error('Server error:', err);
      const appError = await handleError(err);
      if (!res.headersSent) {
        res.status(appError.status).json({
          error: true,
          message: appError.message,
          severity: appError.severity,
          details: app.get('env') === 'development' ? appError.details : undefined
        });
      }
    });

    // Production Static Files
    if (app.get("env") !== "development") {
      const distPath = path.resolve(process.cwd(), "public");
      app.use(express.static(distPath));
      app.use("*", (_req, res) => {
        res.sendFile(path.resolve(distPath, "index.html"));
      });
    }

    // Start listening
    const ports = [5000, 3000, 8080, 4000];
    let serverStarted = false;

    for (const port of ports) {
      try {
        await new Promise((resolve, reject) => {
          server.listen(port, "0.0.0.0")
            .once('listening', () => {
              log(`Server listening on port ${port}`);
              serverStarted = true;
              resolve(true);
            })
            .once('error', (err: any) => {
              if (err.code === 'EADDRINUSE') {
                log(`Port ${port} in use, trying next...`);
                resolve(false);
              } else {
                reject(err);
              }
            });
        });
        if (serverStarted) break;
      } catch (err) {
        if (port === ports[ports.length -1]) throw err;
      }
    }

  } catch (error: any) {
    console.error('Fatal initialization error:', error);
    process.exit(1);
  }
}

initializeServer();