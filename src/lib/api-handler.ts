import { NextRequest, NextResponse } from "next/server";
import express, { Express } from "express";
import { registerRoutes } from "../../server/routes";

// Singleton Express instance and its initialization promise
let expressApp: Express | null = null;
let initializationPromise: Promise<Express> | null = null;

/**
 * Ensures the Express app is initialized exactly once, 
 * correctly awaiting all async setup logic.
 */
async function getExpressApp(): Promise<Express | null> {
  if (expressApp) return expressApp;
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    // Build Guard: Do not initialize Express logic during Next.js build phase
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      return null as any;
    }

    const app = express();
    
    // Basic middleware
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));

    // Register all legacy routes (Auth, Vendors, Requests, etc.)
    // We MUST await this now that registerRoutes is async
    await registerRoutes(app);

    expressApp = app;
    return app;
  })();

  return initializationPromise;
}

/**
 * Robust Bridge to handle Next.js App Router requests via our Express backend logic.
 * This allows us to keep all legacy controllers and middleware intact.
 */
export async function handleApiRequest(req: NextRequest) {
  try {
    const app = await getExpressApp();
    
    if (!app) {
      if (process.env.NEXT_PHASE === 'phase-production-build') {
        return NextResponse.json({ message: "Build mode active" }, { status: 200 });
      }
      return NextResponse.json({ message: "Internal Server Error: App not initialized" }, { status: 500 });
    }

    // Extract info from NextRequest
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;
    const headers = Object.fromEntries(req.headers.entries());
    
    // Read body if exists
    let body: any = null;
    if (["POST", "PUT", "PATCH"].includes(method)) {
      try {
        body = await req.json();
      } catch (e) {
        // No body or invalid JSON
      }
    }

    // We use a Promise with a timeout to prevent infinite hangs
    return await Promise.race([
      new Promise<NextResponse>((resolve, reject) => {
        // Mock Response object for Express
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

            resolve(new NextResponse(this._body, {
              status: this._status,
              headers: responseHeaders,
            }));
          }
        };

        // Mock Request object for Express
        const mockReq: any = {
          url: path + url.search,
          method,
          headers,
          body,
          query: Object.fromEntries(url.searchParams.entries()),
          cookies: parseCookies(headers.cookie || ""),
          app,
        };

        // Trigger Express routing
        try {
          app(mockReq, mockRes);
        } catch (err) {
          reject(err);
        }
      }),
      new Promise<NextResponse>((_, reject) => 
        setTimeout(() => reject(new Error("API Gateway Timeout: Express app took too long to respond.")), 25000)
      )
    ]);
  } catch (error: any) {
    console.error("API Bridge Critical Error:", error);
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
