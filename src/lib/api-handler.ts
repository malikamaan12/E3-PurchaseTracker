import { NextRequest, NextResponse } from "next/server";
import express, { Express } from "express";
import { registerRoutes } from "../../server/routes";

// Singleton Express instance and its initialization promise
let expressApp: Express | null = null;
let initializationPromise: Promise<Express | null> | null = null;

/**
 * Ensures the Express app is initialized exactly once, 
 * correctly awaiting all async setup logic.
 * Added: Hardened 15s timeout to prevent silent "cold start" hangs.
 */
async function getExpressApp(): Promise<Express | null> {
  if (expressApp) return expressApp;
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    console.time("[Init] Total Backend Startup");
    
    // Build Guard: Do not initialize Express logic during Next.js build phase
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      console.log("[Init] Build phase detected. Skipping initialization.");
      return null;
    }

    try {
      // Use a Race to prevent a dead-lock during DB or Auth setup
      return await Promise.race([
        (async () => {
          const app = express();
          
          // Basic middleware
          app.use(express.json({ limit: '10mb' }));
          app.use(express.urlencoded({ extended: true }));

          console.time("[Init] Route Registration");
          // Register all legacy routes (Auth, Vendors, Requests, etc.)
          await registerRoutes(app);
          console.timeEnd("[Init] Route Registration");

          expressApp = app;
          console.timeEnd("[Init] Total Backend Startup");
          return app;
        })(),
        new Promise<null>((_, reject) => 
          setTimeout(() => reject(new Error("CRITICAL: Backend Initialization Timed Out (15s). Database or Auth setup is hanging.")), 15000)
        )
      ]);
    } catch (err) {
      console.error("[Init] Fatal Initialization Error:", err);
      initializationPromise = null; // Allow retry on next request
      throw err;
    }
  })();

  return initializationPromise;
}

/**
 * Robust Bridge to handle Next.js App Router requests via our Express backend logic.
 */
export async function handleApiRequest(req: NextRequest) {
  const traceId = Math.random().toString(36).substring(7);
  console.log(`[API Bridge][${traceId}] Request Start: ${req.method} ${req.url}`);

  try {
    const app = await getExpressApp();
    
    if (!app) {
      if (process.env.NEXT_PHASE === 'phase-production-build') {
        return NextResponse.json({ message: "Build mode active" }, { status: 200 });
      }
      return NextResponse.json({ 
        error: "Initialization Failure", 
        message: "The backend failed to start correctly. Check server logs." 
      }, { status: 503 });
    }

    // Extract info from NextRequest
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;
    const headers = Object.fromEntries(req.headers.entries());
    
    // Read body safely
    let body: any = null;
    if (["POST", "PUT", "PATCH"].includes(method)) {
      try {
        body = await req.json();
      } catch (e) {
        // No body or invalid JSON
      }
    }

    // Process request with a timeout guard
    return await Promise.race([
      new Promise<NextResponse>((resolve, reject) => {
        const mockRes: any = {
          _status: 200,
          _headers: {} as Record<string, any>,
          _body: null as any,
          
          status(code: number) {
            this._status = code;
            return this;
          },
          
          set(name: string, value: string) {
            this._headers[name.toLowerCase()] = value;
            return this;
          },

          setHeader(name: string, value: string) {
            return this.set(name, value);
          },

          header(name: string, value: string) {
            return this.set(name, value);
          },
          
          cookie(name: string, value: string, options: any = {}) {
            let cookie = `${name}=${value}`;
            if (options.maxAge) cookie += `; Max-Age=${options.maxAge / 1000}`;
            if (options.httpOnly) cookie += "; HttpOnly";
            if (options.secure) cookie += "; Secure";
            if (options.sameSite) cookie += `; SameSite=${options.sameSite}`;
            if (options.path) cookie += `; Path=${options.path}`;
            else cookie += "; Path=/";

            const existing = this._headers["set-cookie"] || [];
            const cookies = Array.isArray(existing) ? existing : [existing];
            cookies.push(cookie);
            this._headers["set-cookie"] = cookies;
            return this;
          },

          clearCookie(name: string) {
            return this.cookie(name, "", { maxAge: 0 });
          },
          
          json(data: any) {
            this._body = JSON.stringify(data);
            this._headers["content-type"] = "application/json";
            this.end();
          },

          send(data: any) {
            if (typeof data === "object") return this.json(data);
            this._body = data;
            this.end();
          },

          end(data?: any) {
            if (data) this._body = data;
            
            const responseHeaders = new Headers();
            Object.entries(this._headers).forEach(([k, v]: [string, any]) => {
              if (Array.isArray(v)) {
                v.forEach(val => responseHeaders.append(k, val));
              } else {
                responseHeaders.set(k, v);
              }
            });

            console.log(`[API Bridge][${traceId}] Request Finished: ${this._status}`);
            resolve(new NextResponse(this._body, {
              status: this._status,
              headers: responseHeaders,
            }));
          }
        };

        const mockReq: any = {
          url: path + url.search,
          method,
          headers,
          body,
          query: Object.fromEntries(url.searchParams.entries()),
          cookies: parseCookies(headers.cookie || ""),
          app,
        };

        // Express Global Error Handler for the bridge
        app.use((err: any, _req: any, res: any, _next: any) => {
          console.error(`[API Bridge][${traceId}] Express Error:`, err);
          res.status(err.status || 500).json({ 
            error: "Express Error", 
            message: err.message 
          });
        });

        // Trigger Express routing
        console.log(`[API Bridge][${traceId}] Executing Express handler...`);
        app(mockReq, mockRes);
      }),
      new Promise<NextResponse>((_, reject) => 
        setTimeout(() => reject(new Error(`API Gateway Timeout: ${method} ${url.pathname} took too long to respond.`)), 25000)
      )
    ]);
  } catch (error: any) {
    console.error(`[API Bridge][${traceId}] Critical Bridge Error:`, error);
    return NextResponse.json({ 
      error: "Internal Server Error", 
      message: error.message 
    }, { status: 500 });
  }
}

function parseCookies(cookieStr: string) {
  const cookies: Record<string, string> = {};
  if (!cookieStr) return cookies;
  cookieStr.split(";").forEach((c) => {
    const [key, value] = c.split("=").map((s) => s.trim());
    if (key && value) cookies[key] = value;
  });
  return cookies;
}
