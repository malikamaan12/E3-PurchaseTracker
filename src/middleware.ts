import { NextRequest, NextResponse } from "next/server";
import { TOKEN_COOKIE_NAME } from "@/lib/utils/config";

/**
 * Next.js Edge Middleware for Security Hardening & Site Scraping Protection
 * 
 * Capabilities:
 * 1. Blocks automated scrapers and bots based on User-Agent signatures.
 * 2. Injects anti-indexing and anti-scraping headers (X-Robots-Tag).
 * 3. Enforces session cookie presence on protected web dashboard routes.
 * 4. Passes through verified requests with security context.
 */

// Automated scrapers, content harvesters, and malicious bot user-agent signatures
const BLOCKED_USER_AGENTS = [
  /python-requests/i,
  /aiohttp/i,
  /scrapy/i,
  /libwww-perl/i,
  /go-http-client/i,
  /apache-httpclient/i,
  /httpclient/i,
  /wget\//i,
  /bytespider/i,
  /petalbot/i,
  /megaindex/i,
  /webcopier/i,
  /httrack/i,
  /teleport/i,
];

// Paths that require authenticated web session (redirect to login if unauthenticated)
const PROTECTED_PAGE_PREFIXES = [
  "/dashboard",
  "/requests",
  "/admin",
  "/settings",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const userAgent = req.headers.get("user-agent") || "";
  const isCronRoute = pathname.startsWith("/api/cron");

  // 1. Bot & Scraper Detection (Allow Vercel Cron and explicit internal tests)
  if (!isCronRoute && !userAgent.includes("vercel-cron")) {
    const isScraper = BLOCKED_USER_AGENTS.some((pattern) => pattern.test(userAgent));
    if (isScraper) {
      console.warn(`[Security Middleware] Blocked scraper User-Agent: "${userAgent}" targeting ${pathname}`);
      return new NextResponse(
        JSON.stringify({
          error: "Access Denied",
          message: "Automated scraping and programmatic access via unauthorized clients is prohibited.",
        }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            "X-Robots-Tag": "noindex, nofollow, noarchive",
          },
        }
      );
    }
  }

  // 2. Protected UI Page Routing Guard (Edge Redirect)
  const isProtectedPage = PROTECTED_PAGE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (isProtectedPage) {
    const token = req.cookies.get(TOKEN_COOKIE_NAME)?.value;
    if (!token) {
      const loginUrl = new URL("/auth/login", req.url);
      loginUrl.searchParams.set("returnUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 3. Forward request with Anti-Scraping / Security Headers
  const response = NextResponse.next();

  // Enforce no-index and no-archive across all API and application responses
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt
     * - Static asset extensions (.png, .jpg, .jpeg, .svg, .webp, .ico, .css, .js)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|ttf|ico|css|js)$).*)",
  ],
};
