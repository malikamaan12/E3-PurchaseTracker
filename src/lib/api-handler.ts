import { NextRequest, NextResponse } from "next/server";
import express, { Express } from "express";
import { registerRoutes } from "../../server/routes";

// Singleton Express instance to avoid re-initializing on every request
let expressApp: Express | null = null;

function getExpressApp() {
  if (expressApp) return expressApp;

  // Build Guard: Do not initialize Express logic during Next.js build phase
  // This prevents build-time execution of server-only / native logic
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return null as any;
  }

  expressApp = express();
  
  // Basic middleware already handled by Next.js or needed for Express logic
  expressApp.use(express.json({ limit: '10mb' }));
  expressApp.use(express.urlencoded({ extended: true }));

  // Register all legacy routes (Auth, Vendors, Requests, etc.)
  registerRoutes(expressApp);

  return expressApp;
}

/**
 * Robust Bridge to handle Next.js App Router requests via our Express backend logic.
 * This allows us to keep all legacy controllers and middleware intact.
 */
export async function handleApiRequest(req: NextRequest) {
  const app = getExpressApp();
  
  // Extract info from NextRequest
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;
  const headers = Object.fromEntries(req.headers.entries());
  
  // Read body if exists
  let body = null;
  if (["POST", "PUT", "PATCH"].includes(method)) {
    try {
      body = await req.json();
    } catch (e) {
      // No body or invalid JSON
    }
  }

  // We use a Promise to wait for Express to finish processing
  return new Promise<NextResponse>((resolve) => {
    // Mock Response object for Express
    const mockRes: any = {
      _status: 200,
      _headers: {} as Record<string, string>,
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
      
      cookie(name: string, value: string, options: any) {
        // Simple cookie string generation
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
        this._headers["set-cookie"] = cookies as any;
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
    app(mockReq, mockRes);
  });
}

function parseCookies(cookieStr: string) {
  const cookies: Record<string, string> = {};
  cookieStr.split(";").forEach((c) => {
    const [key, value] = c.split("=").map((s) => s.trim());
    if (key && value) cookies[key] = value;
  });
  return cookies;
}
