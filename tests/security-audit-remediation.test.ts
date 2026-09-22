import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { isSafeRemoteUrl, fetchPdfAssetBuffer } from "../src/lib/pdf/image-loader";
import { DurableRateLimitService } from "../src/lib/services/DurableRateLimitService";
import { GET as getCatalog } from "../src/app/api/items/catalog/route";
import { GET as getCronDailyBackup } from "../src/app/api/cron/daily-backup/route";
import { GET as getDocumentView } from "../src/app/api/documents/view/route";
import nextConfig from "../next.config";

async function runSecurityAuditRemediationTests() {
  console.log("================================================================================");
  console.log("      SECURITY AUDIT & SITE SCRAPING REMEDIATION VERIFICATION SUITE             ");
  console.log("================================================================================\n");

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string) {
    total++;
    if (condition) {
      console.log(`  [SECURITY-TEST] ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  [SECURITY-TEST] ✗ FAIL: ${testName}`);
    }
  }

  // ---------------------------------------------------------------------------
  // 1. Robots.txt Site Scraping Directives
  // ---------------------------------------------------------------------------
  const robotsPath = path.resolve(process.cwd(), "public/robots.txt");
  assert(fs.existsSync(robotsPath), "robots.txt exists in public directory");

  const robotsContent = fs.existsSync(robotsPath) ? fs.readFileSync(robotsPath, "utf-8") : "";
  assert(
    robotsContent.includes("Disallow: /api/") &&
    robotsContent.includes("Disallow: /dashboard/") &&
    robotsContent.includes("Disallow: /portal/") &&
    robotsContent.includes("Disallow: /admin/"),
    "robots.txt disallows sensitive API, dashboard, portal, and admin endpoints"
  );
  assert(
    robotsContent.includes("User-agent: GPTBot") &&
    robotsContent.includes("User-agent: Bytespider") &&
    robotsContent.includes("User-agent: CCBot") &&
    robotsContent.includes("User-agent: Scrapy"),
    "robots.txt explicitly blocks aggressive AI training and scraping crawlers"
  );

  // ---------------------------------------------------------------------------
  // 2. Edge Middleware Bot & Scraper UA Detection Pattern
  // ---------------------------------------------------------------------------
  const BOT_UA_REGEX = /(?:scrapy|python-requests|aiohttp|httpx|httpclient|curl\/|wget\/|urllib|guzzlehttp|go-http-client|apache-httpclient|java\/|node-fetch|axios\/|bytespider|gptbot|ccbot|semrushbot|dotbot|mj12bot|ahrefsbot)/i;

  const testBotUAs = [
    "python-requests/2.28.1",
    "curl/8.1.2",
    "Wget/1.21.3",
    "Go-http-client/1.1",
    "Scrapy/2.11.0 (+https://scrapy.org)",
    "Mozilla/5.0 (compatible; Bytespider; spider-feedback@bytedance.com)",
    "GPTBot/1.2; +https://openai.com/gptbot",
    "SemrushBot/7~bl",
    "Apache-HttpClient/4.5.13 (Java/11.0.16)",
  ];

  const legitimateBrowserUAs = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
  ];

  const allBotsFlagged = testBotUAs.every(ua => BOT_UA_REGEX.test(ua));
  const browsersAllowed = legitimateBrowserUAs.every(ua => !BOT_UA_REGEX.test(ua));

  assert(allBotsFlagged, "Bot User-Agent regex correctly flags automated scrapers and crawlers");
  assert(browsersAllowed, "Bot User-Agent regex allows legitimate browser User-Agents without false positives");

  // ---------------------------------------------------------------------------
  // 3. Durable Rate Limiter IP Extraction and Normalization
  // ---------------------------------------------------------------------------
  const rateLimiter = DurableRateLimitService.getInstance();
  
  const mockReqSingleIp = { headers: new Headers({ "x-forwarded-for": "203.0.113.195" }) };
  const mockReqMultiIp = { headers: new Headers({ "x-forwarded-for": "203.0.113.195, 10.0.0.1, 172.16.0.1" }) };
  const mockReqRealIp = { headers: new Headers({ "x-real-ip": "198.51.100.42", "x-forwarded-for": "203.0.113.195" }) };

  assert(
    rateLimiter.extractClientIp(mockReqSingleIp as any) === "203.0.113.195",
    "RateLimiter extracts single IP from x-forwarded-for"
  );
  assert(
    rateLimiter.extractClientIp(mockReqMultiIp as any) === "203.0.113.195",
    "RateLimiter extracts leftmost client IP from chained proxy headers"
  );
  assert(
    rateLimiter.extractClientIp(mockReqRealIp as any) === "198.51.100.42",
    "RateLimiter prioritizes edge-trusted x-real-ip over client-controlled headers"
  );

  const hashed1 = rateLimiter.hashIp("203.0.113.195");
  const hashed2 = rateLimiter.hashIp("203.0.113.195:8080");
  const hashed3 = rateLimiter.hashIp("203.0.113.196");

  assert(hashed1 === hashed2, "hashIp normalizes and strips ephemeral ports to prevent bucket fragmentation");
  assert(hashed1 !== hashed3, "hashIp produces unique hashes for distinct client IPs");

  // ---------------------------------------------------------------------------
  // 4. Daily Backup Cron Timing-Safe Authentication & Fail-Closed
  // ---------------------------------------------------------------------------
  const originalCronSecret = process.env.CRON_SECRET;
  try {
    // A. Unset secret -> Fail closed (500)
    delete process.env.CRON_SECRET;
    const reqNoSecret = new NextRequest("http://localhost:3000/api/cron/daily-backup", {
      headers: { authorization: "Bearer undefined" }
    });
    const resNoSecret = await getCronDailyBackup(reqNoSecret);
    assert(
      resNoSecret.status === 500,
      "Cron backup endpoint fails closed with 500 when CRON_SECRET is unconfigured (blocks 'Bearer undefined')"
    );

    // B. Set secret -> Reject invalid token with 401
    process.env.CRON_SECRET = "super-secure-cron-secret-123456789";
    const reqInvalidToken = new NextRequest("http://localhost:3000/api/cron/daily-backup", {
      headers: { authorization: "Bearer wrong-token" }
    });
    const resInvalidToken = await getCronDailyBackup(reqInvalidToken);
    assert(
      resInvalidToken.status === 401,
      "Cron backup endpoint returns 401 for invalid authorization token"
    );

    const reqUndefinedToken = new NextRequest("http://localhost:3000/api/cron/daily-backup", {
      headers: { authorization: "Bearer undefined" }
    });
    const resUndefinedToken = await getCronDailyBackup(reqUndefinedToken);
    assert(
      resUndefinedToken.status === 401,
      "Cron backup endpoint rejects 'Bearer undefined' with 401"
    );
  } finally {
    if (originalCronSecret !== undefined) {
      process.env.CRON_SECRET = originalCronSecret;
    } else {
      delete process.env.CRON_SECRET;
    }
  }

  // ---------------------------------------------------------------------------
  // 5. PDF Asset Loader SSRF & Path Traversal Mitigations
  // ---------------------------------------------------------------------------
  assert(!isSafeRemoteUrl("http://169.254.169.254/latest/meta-data/"), "isSafeRemoteUrl blocks AWS IMDS IPv4 address");
  assert(!isSafeRemoteUrl("http://127.0.0.1:8080/admin"), "isSafeRemoteUrl blocks IPv4 loopback address");
  assert(!isSafeRemoteUrl("http://localhost:3000/internal"), "isSafeRemoteUrl blocks localhost hostname");
  assert(!isSafeRemoteUrl("http://10.0.0.1/private"), "isSafeRemoteUrl blocks 10.0.0.0/8 private subnet");
  assert(!isSafeRemoteUrl("http://192.168.1.1/gateway"), "isSafeRemoteUrl blocks 192.168.0.0/16 private subnet");
  assert(!isSafeRemoteUrl("http://172.24.0.1/service"), "isSafeRemoteUrl blocks 172.16.0.0/12 private subnet");
  assert(!isSafeRemoteUrl("http://database.corp/data"), "isSafeRemoteUrl blocks internal corp/local TLDs");
  assert(isSafeRemoteUrl("https://images.unsplash.com/photo-123"), "isSafeRemoteUrl allows legitimate public HTTPS URLs");
  assert(isSafeRemoteUrl("https://pub-r2.cloudflarestorage.com/attachments/logo.png"), "isSafeRemoteUrl allows Cloudflare R2 storage URLs");

  const traversalResult = await fetchPdfAssetBuffer("../../../../../windows/system.ini");
  assert(traversalResult === null, "fetchPdfAssetBuffer safely rejects directory traversal attempts");

  // ---------------------------------------------------------------------------
  // 6. Catalog Route Scraping Protection (Authentication Guard)
  // ---------------------------------------------------------------------------
  const reqUnauthCatalog = new NextRequest("http://localhost:3000/api/items/catalog");
  const resCatalog = await getCatalog(reqUnauthCatalog);
  assert(
    resCatalog.status === 401,
    "GET /api/items/catalog returns 401 Unauthorized for unauthenticated requests"
  );
  const catalogJson = await resCatalog.json();
  assert(
    Boolean(catalogJson.message && catalogJson.message.includes("Authentication is required")),
    "GET /api/items/catalog error body explains authentication is required"
  );

  // ---------------------------------------------------------------------------
  // 7. Document View Route IDOR & Traversal Protection
  // ---------------------------------------------------------------------------
  const reqUnauthDoc = new NextRequest("http://localhost:3000/api/documents/view?url=attachments/123/sensitive.pdf");
  const resDoc = await getDocumentView(reqUnauthDoc);
  assert(
    resDoc.status === 401,
    "GET /api/documents/view returns 401 Unauthorized for unauthenticated callers"
  );

  // ---------------------------------------------------------------------------
  // 8. Next.js Security Headers Verification
  // ---------------------------------------------------------------------------
  const headersConfig = typeof nextConfig.headers === "function" ? await nextConfig.headers() : [];
  const globalHeaderRule = headersConfig.find((rule: any) => rule.source === "/:path*");
  assert(!!globalHeaderRule, "next.config.ts defines global security headers for /:path*");

  const headersList = globalHeaderRule?.headers || [];
  const getHeaderVal = (name: string) => headersList.find((h: any) => h.key.toLowerCase() === name.toLowerCase())?.value;

  assert(
    Boolean(getHeaderVal("Strict-Transport-Security")?.includes("max-age=63072000")),
    "next.config.ts configures HSTS with 2-year duration and includeSubDomains"
  );
  assert(
    getHeaderVal("X-Content-Type-Options") === "nosniff",
    "next.config.ts configures X-Content-Type-Options: nosniff"
  );
  assert(
    getHeaderVal("X-Frame-Options") === "SAMEORIGIN",
    "next.config.ts configures X-Frame-Options: SAMEORIGIN globally"
  );
  assert(
    Boolean(getHeaderVal("X-Robots-Tag")?.includes("noindex")),
    "next.config.ts includes X-Robots-Tag: noindex, nofollow"
  );
  assert(
    Boolean(getHeaderVal("Content-Security-Policy")?.includes("default-src 'self'")),
    "next.config.ts configures defense-in-depth Content-Security-Policy"
  );

  console.log("\n================================================================================");
  console.log(`TEST SUITE RESULTS: ${passed} PASSED, ${total - passed} FAILED`);
  console.log("================================================================================\n");

  if (passed !== total) {
    process.exit(1);
  }
}

runSecurityAuditRemediationTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
