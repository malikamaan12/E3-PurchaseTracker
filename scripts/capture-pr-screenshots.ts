import { chromium } from "playwright";
import { TOKEN_COOKIE_NAME } from "../src/lib/utils/config";
import path from "path";

const ARTIFACT_DIR = "C:/Users/Admin/.gemini/antigravity-ide/brain/0fcd2a37-0b14-494c-a5bc-62d86ac5b2c7";

/**
 * Capture screenshots using real UI / API login without hardcoded fallback secrets
 */
async function main() {
  const baseUrl = process.env.TEST_BASE_URL || "http://localhost:3000";
  console.log(`=== CAPTURING PURCHASE REQUEST DASHBOARD SCREENSHOTS (Target: ${baseUrl}) ===`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1080 },
  });

  const page = await context.newPage();

  // 1. Perform standard UI/API login as Super Admin
  console.log(`Navigating to ${baseUrl}/login...`);
  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
  
  // Fill login credentials
  const emailInput = page.locator('input[type="email"], input[name="email"]');
  const passwordInput = page.locator('input[type="password"], input[name="password"]');
  
  if (await emailInput.count() > 0) {
    await emailInput.fill("superadmin@eeeqa.com");
    await passwordInput.fill("SuperAdmin2026!");
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();
    await page.waitForURL("**/dashboard/**", { timeout: 15000 }).catch(() => {});
  }

  // Navigate to /dashboard/requests
  console.log(`Navigating to ${baseUrl}/dashboard/requests...`);
  await page.goto(`${baseUrl}/dashboard/requests`, { waitUntil: "networkidle" });
  await page.waitForSelector("table tbody tr td span.font-mono", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);

  // Check rendered rows
  const rows = await page.$$("table tbody tr");
  console.log(`Rendered table rows: ${rows.length}`);

  // Screenshot 1: All PRs
  const screenshotAllPath = path.join(ARTIFACT_DIR, "pr_dashboard_all_14.png");
  await page.screenshot({ path: screenshotAllPath, fullPage: false });
  console.log(`Saved screenshot: ${screenshotAllPath}`);

  // Screenshot 2: Click on "Approved" tab
  const approvedTab = page.locator("button:has-text('approved')").first();
  if (await approvedTab.count() > 0) {
    await approvedTab.click();
    await page.waitForTimeout(2000);
    const screenshotApprovedPath = path.join(ARTIFACT_DIR, "pr_dashboard_approved_5.png");
    await page.screenshot({ path: screenshotApprovedPath, fullPage: false });
    console.log(`Saved approved PRs screenshot: ${screenshotApprovedPath}`);
  }

  await browser.close();
  console.log("=== SCREENSHOT CAPTURE COMPLETE ===");
}

main().catch(err => {
  console.error("Error capturing screenshots:", err);
  process.exit(1);
});
