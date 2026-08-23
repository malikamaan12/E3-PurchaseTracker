import { chromium } from "playwright";
import * as path from "path";
import * as fs from "fs";

const PREVIEW_URL = "https://e3-purchase-tracker-bc6c81lpu-malikamaan12s-projects.vercel.app";
const ARTIFACT_DIR = "C:/Users/Admin/.gemini/antigravity-ide/brain/0fcd2a37-0b14-494c-a5bc-62d86ac5b2c7";

interface NetworkTrace {
  timestamp: string;
  method: string;
  url: string;
  status: number;
  requestBodySnippet?: string;
  responseBodySnippet?: string;
}

function sanitizeString(str: string): string {
  if (!str) return str;
  return str
    .replace(/(token=)[a-zA-Z0-9_-]+/gi, "$1***REDACTED***")
    .replace(/(completionLink['":\s]+)(https?:\/\/[^\s"',#]+)#token=[a-zA-Z0-9_-]+/gi, '$1$2#token=***REDACTED***')
    .replace(/(eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,})/g, "***REDACTED_JWT***")
    .replace(/("tokenHash":\s*")[a-f0-9]{10,}/gi, '$1***REDACTED_HASH***')
    .replace(/("password":\s*")[^"]+"/gi, '$1***REDACTED_PASSWORD***"');
}

async function runSanitizedUAT() {
  console.log("=== Starting Sanitized Preview UAT on", PREVIEW_URL, "===");

  const networkTraces: NetworkTrace[] = [];

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    permissions: ["clipboard-read", "clipboard-write"],
  });

  const page = await context.newPage();

  // Monitor and sanitize network traffic
  page.on("request", (req) => {
    if (req.url().includes("/api/")) {
      const postData = req.postData();
      (req as any)._capturedBody = postData ? sanitizeString(postData) : undefined;
    }
  });

  page.on("response", async (res) => {
    if (res.url().includes("/api/")) {
      try {
        const text = await res.text();
        const sanitizedResp = sanitizeString(text);
        networkTraces.push({
          timestamp: new Date().toISOString(),
          method: res.request().method(),
          url: sanitizeString(res.url()),
          status: res.status(),
          requestBodySnippet: (res.request() as any)._capturedBody?.slice(0, 200),
          responseBodySnippet: sanitizedResp.slice(0, 300),
        });
      } catch (e) {
        // Ignore binary or streaming responses
      }
    }
  });

  try {
    // Step 1: Login with dedicated synthetic UAT account
    const uatCreds = JSON.parse(fs.readFileSync(path.join(process.cwd(), ".uat_credentials.json"), "utf8"));
    console.log("Step 1: Navigating to login page with synthetic UAT account...");
    await page.goto(`${PREVIEW_URL}/login`, { waitUntil: "networkidle" });
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "preview_v3_1_login.png") });

    await page.fill('input[placeholder*="email"]', uatCreds.email);
    await page.fill('input[placeholder*="password"]', uatCreds.password);
    await page.click('button:has-text("ACCESS HUB")');

    await page.waitForURL("**/requests", { timeout: 15000 });
    await page.waitForTimeout(2000);
    console.log("Step 2: Logged in successfully with dedicated synthetic UAT account. Current URL:", page.url());
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "preview_v3_2_dashboard.png") });

    // Step 2: Open Create PR Modal
    console.log("Step 3: Opening Create Request modal...");
    await page.click('button:has-text("New Request")');
    await page.waitForSelector('text=Create Purchase Request', { timeout: 5000 });
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "preview_v3_3_pr_modal.png") });

    // Step 3: Open Quick Create Modal
    console.log("Step 4: Opening Quick Create Vendor modal...");
    await page.click('button:has-text("Quick-Create Vendor")');
    await page.waitForSelector('text=Quick-Create Vendor', { timeout: 5000 });
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "preview_v3_4_quick_create_modal.png") });

    // Step 4: Fill Vendor Details
    const uniqueVendorName = `Apex Global Systems ${Date.now()}`;
    console.log(`Step 5: Filling vendor form with "${uniqueVendorName}"...`);
    await page.fill('input[placeholder*="Al-Rawabi"]', uniqueVendorName);
    await page.fill('input[placeholder*="Ahmed Al-Mansoori"]', 'Fahad Al-Kuwari');
    await page.fill('input[placeholder*="5500 1234"]', '55998877');
    await page.fill('input[placeholder*="billing@vendor.com"]', 'fahad@apexsystems.qa');
    await page.fill('input[placeholder*="Zone 56"]', 'West Bay Financial Tower, Doha');
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "preview_v3_5_quick_create_filled.png") });

    // Step 5: Submit Quick Create Vendor
    console.log("Step 6: Submitting Quick Create Vendor...");
    await page.click('button:has-text("Create & Get Link")');

    // Wait for success screen
    await page.waitForSelector('text=Vendor Created & Ready', { timeout: 10000 });
    console.log("Step 7: Vendor created successfully!");
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "preview_v3_6_quick_create_success.png") });

    // Step 6: Click "Select Vendor & Return to PR"
    console.log("Step 8: Clicking Select Vendor & Return to PR...");
    await page.click('button:has-text("Select Vendor & Return to PR")');
    await page.waitForTimeout(1500);

    // Verify Vendor auto-selected in PR modal and Copy Compliance Link button is rendered
    console.log("Step 9: Verifying auto-selection and compliance link button...");
    await page.waitForSelector('button:has-text("Copy Compliance Link")', { timeout: 10000 });
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "preview_v3_7_vendor_selected_with_copy_btn.png") });

    // Step 7: Click "Copy Compliance Link"
    console.log("Step 10: Clicking Copy Compliance Link...");
    await page.click('button:has-text("Copy Compliance Link")');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "preview_v3_8_link_copied_toast.png") });

    // Step 8: Fill PR details and Submit
    console.log("Step 11: Filling PR details...");
    await page.fill('input[placeholder*="Q3 Logistics Support"]', `High-Bandwidth Network Uplink ${Date.now()}`);
    
    // Select Purpose Category ("Events")
    console.log("Selecting Purpose Category: Events...");
    await page.click('button[role="combobox"]:has-text("Select category...")');
    await page.waitForTimeout(500);
    await page.click('div[role="option"]:has-text("Events")');
    await page.waitForTimeout(1000);

    // Select Project ("Lego Shows")
    console.log("Selecting Project: Lego Shows...");
    await page.click('button[role="combobox"]:has-text("Select Project Lifecycle...")');
    await page.waitForTimeout(500);
    await page.click('div[role="option"]:has-text("Lego Shows")');
    await page.waitForTimeout(500);

    await page.fill('textarea[placeholder*="Detail the scope of work"]', 'Enterprise optical network interconnect and core redundancy routing for main arena.');

    // Next step in PR Wizard (Items)
    console.log("Navigating to Items tab...");
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(1000);

    // Add Item in Desktop Table
    console.log("Step 12: Adding item to PR...");
    await page.locator('table button[role="combobox"]').first().click();
    await page.waitForTimeout(500);
    await page.fill('input[placeholder="Search..."]', '100G Dense Wavelength Fiber Transceivers');
    await page.waitForTimeout(500);
    
    // Click custom value or first match
    const customValueOption = page.locator('button:has-text("Use \\"100G Dense Wavelength Fiber Transceivers\\""), div[role="option"]:has-text("100G Dense Wavelength Fiber Transceivers")');
    if (await customValueOption.count() > 0) {
      await customValueOption.first().click();
    } else {
      await page.keyboard.press("Enter");
    }
    await page.waitForTimeout(500);

    // Fill additional details
    await page.locator('table input[placeholder="Additional details..."]').first().fill('Primary QSFP28 optical modules for backbone switch');

    // Fill Unit Price (estimated cost)
    const unitPriceInput = page.locator('table input[type="number"]').nth(1);
    await unitPriceInput.fill('18000');

    await page.screenshot({ path: path.join(ARTIFACT_DIR, "preview_v3_9_pr_items_filled.png") });

    // Next to Payment
    console.log("Navigating to Payment tab...");
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(800);

    // Next to Files / Approvals
    console.log("Navigating to Files/Approvals tab...");
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(800);

    // Submit PR
    console.log("Step 13: Submitting Purchase Request...");
    await page.click('button:has-text("Submit Request")');

    // Wait for submission completion and dashboard return
    await page.waitForSelector('text=Create Purchase Request', { state: 'hidden', timeout: 20000 });
    await page.waitForTimeout(3000);
    console.log("Step 14: PR submitted successfully!");
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "preview_v3_10_dashboard_table_final.png") });

    console.log("\n========================================================");
    console.log("SANITIZED PREVIEW UAT COMPLETED SUCCESSFULLY WITH 100% PASS!");
    console.log("========================================================");

    // Write sanitized network traces to scratch/network_traces_sanitized.json
    const tracesPath = path.join(ARTIFACT_DIR, "scratch/network_traces_sanitized.json");
    fs.writeFileSync(tracesPath, JSON.stringify(networkTraces, null, 2));
    console.log(`Saved sanitized network traces to: ${tracesPath}`);

  } catch (error) {
    console.error("UAT error:", error);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "preview_v3_error.png") });
    throw error;
  } finally {
    await browser.close();
  }
}

runSanitizedUAT().catch((e) => {
  console.error("UAT script failed:", e);
  process.exit(1);
});
