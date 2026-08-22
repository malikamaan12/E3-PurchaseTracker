import fs from "fs";
import { chromium } from "playwright";
import { SignJWT } from "jose";
import { TOKEN_COOKIE_NAME } from "../src/lib/utils/config";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import path from "path";

const ARTIFACT_DIR = "C:/Users/Admin/.gemini/antigravity-ide/brain/0fcd2a37-0b14-494c-a5bc-62d86ac5b2c7";

function getSecret() {
  try {
    const content = fs.readFileSync(".env.local", "utf8");
    const m = content.match(/JWT_SECRET=["']?([^"'\r\n]+)/);
    if (m) return m[1].trim();
  } catch {}
  return "E3purchase2026";
}

const JWT_SECRET = getSecret();

async function main() {
  console.log(`=== CAPTURING PURCHASE REQUEST DASHBOARD SCREENSHOTS (Secret: ${JWT_SECRET.slice(0, 4)}***) ===`);

  const [superAdminUser] = await db.select().from(users).where(eq(users.role, "super_admin")).limit(1);
  if (!superAdminUser) throw new Error("Super Admin user not found");

  const sanitizedUser = {
    id: superAdminUser.id,
    username: superAdminUser.username,
    email: superAdminUser.email,
    department: superAdminUser.department,
    assignedDepartments: [],
    departmentAssignments: [],
    departments: [superAdminUser.department],
    role: superAdminUser.role,
    contactNumber: superAdminUser.contact_number,
    isActive: superAdminUser.isActive,
    isApprover: true,
    canManageVendors: superAdminUser.canManageVendors
  };

  const secret = new TextEncoder().encode(JWT_SECRET);
  const token = await new SignJWT(sanitizedUser)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("300h")
    .sign(secret);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1080 },
  });

  // Set the auth cookie
  await context.addCookies([
    {
      name: TOKEN_COOKIE_NAME,
      value: token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  const page = await context.newPage();

  console.log("1. Navigating to http://localhost:3000/dashboard/requests...");
  await page.goto("http://localhost:3000/dashboard/requests", { waitUntil: "networkidle" });
  
  // Wait for table to load PRs
  console.log("Waiting for PR rows to appear...");
  await page.waitForSelector("table tbody tr td span.font-mono", { timeout: 15000 });
  await page.waitForTimeout(1500);

  // Check how many rows are rendered
  const rows = await page.$$("table tbody tr");
  console.log(`Rendered table rows: ${rows.length}`);

  // Screenshot 1: All 14 PRs
  const screenshotAllPath = path.join(ARTIFACT_DIR, "pr_dashboard_all_14.png");
  await page.screenshot({ path: screenshotAllPath, fullPage: false });
  console.log(`Saved screenshot: ${screenshotAllPath}`);

  // Screenshot 2: Click on "Approved" status filter tab
  console.log("2. Clicking 'Approved' tab...");
  const approvedTab = page.locator("button:has-text('approved')").first();
  await approvedTab.click();
  await page.waitForTimeout(2000);
  
  const approvedRows = await page.$$("table tbody tr");
  console.log(`Rendered approved rows: ${approvedRows.length}`);
  const screenshotApprovedPath = path.join(ARTIFACT_DIR, "pr_dashboard_approved_5.png");
  await page.screenshot({ path: screenshotApprovedPath, fullPage: false });
  console.log(`Saved approved PRs screenshot: ${screenshotApprovedPath}`);

  // Screenshot 3: Detailed view of approved PR 68
  console.log("3. Navigating to PR #68 detail...");
  await page.goto("http://localhost:3000/dashboard/requests/68", { waitUntil: "networkidle" });
  await page.waitForSelector("h1, h2, h3, span", { timeout: 15000 });
  await page.waitForTimeout(1500);
  const screenshotPr68Path = path.join(ARTIFACT_DIR, "pr_68_approved_detail.png");
  await page.screenshot({ path: screenshotPr68Path, fullPage: false });
  console.log(`Saved PR #68 screenshot: ${screenshotPr68Path}`);

  // Screenshot 4: Detailed view of approved PR 74
  console.log("4. Navigating to PR #74 detail...");
  await page.goto("http://localhost:3000/dashboard/requests/74", { waitUntil: "networkidle" });
  await page.waitForSelector("h1, h2, h3, span", { timeout: 15000 });
  await page.waitForTimeout(1500);
  const screenshotPr74Path = path.join(ARTIFACT_DIR, "pr_74_approved_detail.png");
  await page.screenshot({ path: screenshotPr74Path, fullPage: false });
  console.log(`Saved PR #74 screenshot: ${screenshotPr74Path}`);

  // Screenshot 5: Detailed view of approved PR 77
  console.log("5. Navigating to PR #77 detail...");
  await page.goto("http://localhost:3000/dashboard/requests/77", { waitUntil: "networkidle" });
  await page.waitForSelector("h1, h2, h3, span", { timeout: 15000 });
  await page.waitForTimeout(1500);
  const screenshotPr77Path = path.join(ARTIFACT_DIR, "pr_77_approved_detail.png");
  await page.screenshot({ path: screenshotPr77Path, fullPage: false });
  console.log(`Saved PR #77 screenshot: ${screenshotPr77Path}`);

  await browser.close();
  console.log("=== SCREENSHOT CAPTURE COMPLETE ===");
}

main().catch(err => {
  console.error("Error capturing screenshots:", err);
  process.exit(1);
});
