import { NextRequest, NextResponse } from "next/server";
import express, { Express } from "express";
import { registerRoutes } from "../../server/routes";

// Singleton Express instance and its initialization promise
let expressApp: Express | null = null;
let initializationPromise: Promise<Express | null> | null = null;

async function getExpressApp(): Promise<Express | null> {
  if (expressApp) return expressApp;
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    console.time("[Init] Total Backend Startup");
    if (process.env.NEXT_PHASE === 'phase-production-build') return null;

    try {
      return await Promise.race([
        (async () => {
          const app = express();
          app.use(express.json({ limit: '10mb' }));
          app.use(express.urlencoded({ extended: true }));
          await registerRoutes(app);
          expressApp = app;
          console.timeEnd("[Init] Total Backend Startup");
          return app;
        })(),
        new Promise<null>((_, reject) => 
          setTimeout(() => reject(new Error("Backend Initialization Timed Out (15s)")), 15000)
        )
      ]);
    } catch (err) {
      console.error("[Init] Fatal Initialization Error:", err);
      initializationPromise = null;
      throw err;
    }
  })();

  return initializationPromise;
}

export async function handleApiRequest(req: NextRequest) {
  const traceId = Math.random().toString(36).substring(7);
  console.log(`[API Bridge][${traceId}] Start: ${req.method} ${req.url}`);

  try {
    const app = await getExpressApp();
    if (!app) return NextResponse.json({ message: "Build mode active" }, { status: 200 });

    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;
    const headers = Object.fromEntries(req.headers.entries());
    
    // Cookie Hardening: Ensure cookie header is explicitly present for cookie-parser
    const cookieHeader = req.headers.get("cookie") || "";
    if (cookieHeader) headers["cookie"] = cookieHeader;

    let body = null;
    if (["POST", "PUT", "PATCH"].includes(method)) {
      try { body = await req.json(); } catch (e) {}
    }

    return await Promise.race([
      new Promise<NextResponse>((resolve, reject) => {
        let isResolved = false;

        const mockRes: any = {
          _status: 200,
          _headers: {} as Record<string, any>,
          _body: null as any,
          status(code: number) { this._status = code; return this; },
          set(name: string, value: string) { this._headers[name.toLowerCase()] = value; return this; },
          setHeader(name: string, value: string) { return this.set(name, value); },
          header(name: string, value: string) { return this.set(name, value); },
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
          clearCookie(name: string) { return this.cookie(name, "", { maxAge: 0 }); },
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
            if (isResolved) return;
            isResolved = true;
            if (data) this._body = data;
            const responseHeaders = new Headers();
            Object.entries(this._headers).forEach(([k, v]: [string, any]) => {
              if (Array.isArray(v)) v.forEach(val => responseHeaders.append(k, val));
              else responseHeaders.set(k, v);
            });
            console.log(`[API Bridge][${traceId}] Finished: ${this._status}`);
            resolve(new NextResponse(this._body, { status: this._status, headers: responseHeaders }));
          }
        };

        const mockReq: any = {
          url: path + url.search,
          method,
          headers,
          body,
          query: Object.fromEntries(url.searchParams.entries()),
          cookies: parseCookies(cookieHeader),
          app,
        };

        app(mockReq, mockRes);
      }),
      new Promise<NextResponse>((_, reject) => 
        setTimeout(() => reject(new Error(`API Gateway Timeout: ${method} ${url.pathname} hung for 22s.`)), 22000)
      )
    ]);
  } catch (error: any) {
    console.error(`[API Bridge][${traceId}] Critical Error:`, error);
    return NextResponse.json({ error: "Internal Server Error", message: error.message }, { status: 500 });
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
