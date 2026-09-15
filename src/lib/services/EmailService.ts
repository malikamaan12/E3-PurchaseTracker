import { Resend } from "resend";
import fs from "fs";
import path from "path";

export interface SendNotificationEmailParams {
  to: string;
  userName?: string;
  type: string;
  title: string;
  message: string;
  requestId?: number;
  requestNumber?: string;
  requesterName?: string;
  department?: string;
  amount?: string | number;
  currency?: string;
  vendorName?: string;
  paymentStructure?: string;
  actionUrl?: string;
  priority?: string;
  items?: Array<{
    name: string;
    quantity: number;
    estimatedCost: number;
    description?: string;
    remarks?: string;
  }>;
  actions?: {
    approveUrl: string;
    rejectUrl: string;
    changesUrl: string;
  };
  shortcuts?: {
    overviewUrl?: string;
    itemsUrl?: string;
    attachmentsUrl?: string;
    approvalsUrl?: string;
  };
}

export class EmailService {
  private static instance: EmailService;
  private resendClient: Resend | null = null;
  private currentApiKey: string | null = null;
  private fromEmail: string;
  private appUrl: string;
  private isInitialized = false;

  private constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey && apiKey.trim().length > 0 && !apiKey.includes("replace-me") && !apiKey.includes("re_123456789")) {
      this.currentApiKey = apiKey.trim();
      this.resendClient = new Resend(this.currentApiKey);
    } else {
      this.currentApiKey = null;
      this.resendClient = null;
    }

    this.fromEmail = process.env.RESEND_FROM_EMAIL || "PurchaseTracker <onboarding@resend.dev>";
    this.appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  }

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  /**
   * Asynchronously ensure config is populated from database settings if not in env
   */
  public async ensureConfigured(): Promise<void> {
    if (this.resendClient) return;

    try {
      const { SettingsService } = await import("./SettingsService");
      const dbKey = await SettingsService.getSetting<string>("resend_api_key");
      const dbFrom = await SettingsService.getSetting<string>("resend_from_email");

      if (dbKey && dbKey.trim().length > 0 && !dbKey.includes("replace-me") && !dbKey.includes("re_123456789")) {
        this.currentApiKey = dbKey.trim();
        this.resendClient = new Resend(this.currentApiKey);
        process.env.RESEND_API_KEY = this.currentApiKey;
      }

      if (dbFrom && dbFrom.trim().length > 0) {
        this.fromEmail = dbFrom.trim();
        process.env.RESEND_FROM_EMAIL = this.fromEmail;
      }
    } catch (err) {
      console.warn("[EmailService] Failed to read database system settings for Resend:", err);
    }
  }

  /**
   * Check if active Resend API key is configured
   */
  public isConfigured(): boolean {
    const apiKey = this.currentApiKey || process.env.RESEND_API_KEY;
    return Boolean(apiKey && apiKey.trim().length > 0 && !apiKey.includes("replace-me") && !apiKey.includes("re_123456789"));
  }

  /**
   * Get current connection status and masked credentials
   */
  public async getStatus(): Promise<{
    connected: boolean;
    maskedApiKey?: string;
    fromEmail: string;
    source: "environment" | "database" | "none";
  }> {
    await this.ensureConfigured();

    const apiKey = this.currentApiKey || process.env.RESEND_API_KEY;
    const isReady = Boolean(apiKey && apiKey.trim().length > 0 && !apiKey.includes("replace-me") && !apiKey.includes("re_123456789"));

    let masked = "";
    if (isReady && apiKey) {
      const trimmed = apiKey.trim();
      masked = trimmed.length > 8
        ? `${trimmed.substring(0, 5)}••••••••${trimmed.substring(trimmed.length - 4)}`
        : "••••••••";
    }

    let source: "environment" | "database" | "none" = "none";
    if (isReady) {
      source = process.env.RESEND_API_KEY ? "environment" : "database";
    }

    return {
      connected: isReady,
      maskedApiKey: masked || undefined,
      fromEmail: this.fromEmail,
      source
    };
  }

  /**
   * Verify an API key with Resend's API and save to database and .env.local
   */
  public async verifyAndConnect(
    apiKey: string,
    fromEmail?: string,
    userId?: number
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    const cleanedKey = (apiKey || "").trim();
    if (!cleanedKey || !cleanedKey.startsWith("re_")) {
      return { success: false, error: "Invalid Resend API Key. Keys must start with 're_'." };
    }

    const testClient = new Resend(cleanedKey);

    try {
      // Test key validity against Resend API
      const response = await testClient.apiKeys.list();
      if (response.error) {
        return { success: false, error: response.error.message || "Failed to authenticate with Resend API." };
      }

      // Valid key! Update memory
      this.currentApiKey = cleanedKey;
      this.resendClient = testClient;
      process.env.RESEND_API_KEY = cleanedKey;

      if (fromEmail && fromEmail.trim().length > 0) {
        this.fromEmail = fromEmail.trim();
        process.env.RESEND_FROM_EMAIL = this.fromEmail;
      }

      // 1. Save to database system_settings
      try {
        const { SettingsService } = await import("./SettingsService");
        await SettingsService.setSetting("resend_api_key", cleanedKey, userId);
        if (fromEmail) {
          await SettingsService.setSetting("resend_from_email", this.fromEmail, userId);
        }
      } catch (dbErr) {
        console.warn("[EmailService] Failed to persist Resend settings to DB:", dbErr);
      }

      // 2. Persist to .env.local on filesystem
      this.updateEnvFile("RESEND_API_KEY", cleanedKey);
      if (fromEmail) {
        this.updateEnvFile("RESEND_FROM_EMAIL", this.fromEmail);
      }

      console.log("[EmailService] Successfully connected and verified Resend API key.");
      return {
        success: true,
        message: "Resend successfully connected! Real emails will now be dispatched for active notifications."
      };
    } catch (err: any) {
      console.error("[EmailService] Exception verifying Resend API key:", err);
      return { success: false, error: err?.message || "Network error communicating with Resend." };
    }
  }

  /**
   * Update the sender (From) email address in memory, database, and local env
   */
  public async setFromEmail(fromEmail: string, userId?: number): Promise<void> {
    const trimmed = fromEmail.trim();
    if (!trimmed) return;
    this.fromEmail = trimmed;
    process.env.RESEND_FROM_EMAIL = trimmed;
    try {
      const { SettingsService } = await import("./SettingsService");
      await SettingsService.setSetting("resend_from_email", trimmed, userId);
    } catch (err) {
      console.warn("[EmailService] Failed to save resend_from_email to DB:", err);
    }
    this.updateEnvFile("RESEND_FROM_EMAIL", trimmed);
  }

  /**
   * Helper to write or update a key in .env.local
   */
  private updateEnvFile(key: string, value: string): void {
    try {
      const envPath = path.resolve(process.cwd(), ".env.local");
      let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";
      const lineRegex = new RegExp(`^${key}=.*$`, "m");
      const newLine = `${key}="${value}"`;

      if (lineRegex.test(content)) {
        content = content.replace(lineRegex, newLine);
      } else {
        content = content.trimEnd() + `\n${newLine}\n`;
      }

      fs.writeFileSync(envPath, content, "utf-8");
    } catch (err) {
      console.warn(`[EmailService] Failed to update ${key} in .env.local:`, err);
    }
  }

  /**
   * Reload client from environment variables (useful if config changes at runtime)
   */
  public reloadConfig(): void {
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey && apiKey.trim().length > 0 && !apiKey.includes("replace-me") && !apiKey.includes("re_123456789")) {
      this.currentApiKey = apiKey.trim();
      this.resendClient = new Resend(this.currentApiKey);
    } else {
      this.currentApiKey = null;
      this.resendClient = null;
    }
    this.fromEmail = process.env.RESEND_FROM_EMAIL || "PurchaseTracker <onboarding@resend.dev>";
    this.appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  }

  /**
   * Send a notification email
   */
  public async sendNotificationEmail(params: SendNotificationEmailParams): Promise<{ success: boolean; id?: string; error?: string }> {
    const { to, title, message, type, requestId, actionUrl } = params;

    if (!to || !to.includes("@")) {
      console.warn(`[EmailService] Invalid recipient email address: "${to}". Skipping email dispatch.`);
      return { success: false, error: "Invalid recipient email" };
    }

    // Ensure client is initialized from DB if missing from env
    await this.ensureConfigured();

    const fullActionUrl = actionUrl
      ? (actionUrl.startsWith("http") ? actionUrl : `${this.appUrl}${actionUrl.startsWith("/") ? "" : "/"}${actionUrl}`)
      : (requestId ? `${this.appUrl}/dashboard/requests/${requestId}` : `${this.appUrl}/dashboard/requests`);

    const preferencesUrl = `${this.appUrl}/dashboard/settings/notifications`;
    const emailSubject = `[PurchaseTracker] ${title}`;
    const emailHtml = this.generateEmailHtml({ ...params, actionUrl: fullActionUrl, preferencesUrl });

    // Fallback simulation when Resend is not configured
    if (!this.resendClient) {
      console.log(`[EmailService - Simulated] Resend API key not configured. Would send email:
  To: ${to}
  Subject: ${emailSubject}
  Type: ${type}
  Action URL: ${fullActionUrl}
      `);
      return { success: true, id: `simulated_${Date.now()}` };
    }

    try {
      const response = await this.resendClient.emails.send({
        from: this.fromEmail,
        to: [to],
        subject: emailSubject,
        html: emailHtml,
      });

      if (response.error) {
        console.error(`[EmailService] Resend API error sending email to ${to}:`, response.error);
        return { success: false, error: response.error.message };
      }

      console.log(`[EmailService] Notification email sent successfully to ${to} (ID: ${response.data?.id})`);
      return { success: true, id: response.data?.id };
    } catch (err: any) {
      console.error(`[EmailService] Failed to dispatch email via Resend to ${to}:`, err?.message || err);
      return { success: false, error: err?.message || "Failed to send email" };
    }
  }

  /**
   * Send a verification / test email to confirm Resend delivery
   */
  public async sendTestEmail(toEmail: string, userName: string = "User"): Promise<{ success: boolean; id?: string; error?: string }> {
    return this.sendNotificationEmail({
      to: toEmail,
      userName,
      type: "test_notification",
      title: "Resend Notification Verification",
      message: `Hello ${userName}, this is a test notification confirming your email alerts are connected and functioning properly on PurchaseTracker.`,
      priority: "normal",
      actionUrl: "/dashboard/settings/notifications"
    });
  }

  /**
   * Generate responsive, enterprise-grade HTML email template
   */
  private generateEmailHtml(params: SendNotificationEmailParams & { preferencesUrl: string }): string {
    const {
      to,
      userName,
      title,
      message,
      type,
      requestId,
      requestNumber,
      requesterName,
      department,
      amount,
      currency,
      vendorName,
      paymentStructure,
      actionUrl,
      priority,
      items,
      actions,
      shortcuts,
      preferencesUrl
    } = params;

    let badgeColor = "#2563eb";
    let badgeBg = "#eff6ff";
    let badgeText = "UPDATE";

    if (type.includes("approval_required") || type.includes("pending_approval")) {
      badgeColor = "#d97706";
      badgeBg = "#fef3c7";
      badgeText = "ACTION REQUIRED: APPROVAL";
    } else if (type.includes("approved") || type.includes("granted")) {
      badgeColor = "#059669";
      badgeBg = "#d1fae5";
      badgeText = "REQUEST APPROVED";
    } else if (type.includes("rejected")) {
      badgeColor = "#e11d48";
      badgeBg = "#ffe4e6";
      badgeText = "REQUEST REJECTED";
    } else if (type.includes("changes_requested")) {
      badgeColor = "#ea580c";
      badgeBg = "#ffedd5";
      badgeText = "CHANGES REQUESTED";
    } else if (type.includes("new_request") || type.includes("submitted")) {
      badgeColor = "#0284c7";
      badgeBg = "#e0f2fe";
      badgeText = "NEW SUBMISSION";
    } else if (type.includes("vendor")) {
      badgeColor = "#7c3aed";
      badgeBg = "#ede9fe";
      badgeText = "VENDOR UPDATE";
    } else if (type === "test_notification") {
      badgeColor = "#059669";
      badgeBg = "#d1fae5";
      badgeText = "SYSTEM TEST VERIFIED";
    }

    const priorityBadge = priority && priority.toLowerCase() === "high" 
      ? `<span style="background-color: #fee2e2; color: #b91c1c; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 9999px; text-transform: uppercase; margin-left: 6px; letter-spacing: 0.05em;">HIGH PRIORITY</span>`
      : "";

    // ── Quick Navigation Shortcuts ───────────────────────────────────────────
    const baseRequestUrl = requestId ? `${this.appUrl}/dashboard/requests/${requestId}` : this.appUrl;
    const navShortcuts = requestId ? `
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px; border-bottom: 1px solid #e2e8f0; padding-bottom: 14px;">
        <tr>
          <td align="left" style="font-size: 12px; font-weight: 600;">
            <span style="color: #64748b; margin-right: 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;">Quick Jump:</span>
            <a href="${escapeHtml(shortcuts?.overviewUrl || `${baseRequestUrl}#overview`)}" style="color: #2563eb; text-decoration: none; padding: 4px 8px; background-color: #f1f5f9; border-radius: 6px; margin-right: 6px; display: inline-block;">📄 Overview</a>
            <a href="${escapeHtml(shortcuts?.itemsUrl || `${baseRequestUrl}#line-items`)}" style="color: #2563eb; text-decoration: none; padding: 4px 8px; background-color: #f1f5f9; border-radius: 6px; margin-right: 6px; display: inline-block;">📦 Line Items</a>
            <a href="${escapeHtml(shortcuts?.attachmentsUrl || `${baseRequestUrl}#attachments`)}" style="color: #2563eb; text-decoration: none; padding: 4px 8px; background-color: #f1f5f9; border-radius: 6px; margin-right: 6px; display: inline-block;">📎 Files</a>
            <a href="${escapeHtml(shortcuts?.approvalsUrl || `${baseRequestUrl}#approvals`)}" style="color: #2563eb; text-decoration: none; padding: 4px 8px; background-color: #f1f5f9; border-radius: 6px; display: inline-block;">👥 Approvers</a>
          </td>
        </tr>
      </table>
    ` : "";

    // ── Request Summary Card ─────────────────────────────────────────────────
    const summaryRows: string[] = [];
    if (requestNumber) {
      summaryRows.push(`
        <tr>
          <td style="padding: 7px 12px; color: #64748b; font-size: 13px; font-weight: 500; border-bottom: 1px solid #f1f5f9; width: 34%;">Request ID:</td>
          <td style="padding: 7px 12px; color: #0f172a; font-size: 13px; font-weight: 700; font-family: monospace; border-bottom: 1px solid #f1f5f9;">${escapeHtml(requestNumber)}</td>
        </tr>
      `);
    }
    if (requesterName) {
      summaryRows.push(`
        <tr>
          <td style="padding: 7px 12px; color: #64748b; font-size: 13px; font-weight: 500; border-bottom: 1px solid #f1f5f9;">Requester:</td>
          <td style="padding: 7px 12px; color: #0f172a; font-size: 13px; font-weight: 600; border-bottom: 1px solid #f1f5f9;">${escapeHtml(requesterName)} ${department ? `<span style="color: #64748b; font-weight: normal;">(${escapeHtml(department)})</span>` : ""}</td>
        </tr>
      `);
    }
    if (vendorName) {
      summaryRows.push(`
        <tr>
          <td style="padding: 7px 12px; color: #64748b; font-size: 13px; font-weight: 500; border-bottom: 1px solid #f1f5f9;">Vendor:</td>
          <td style="padding: 7px 12px; color: #0f172a; font-size: 13px; font-weight: 600; border-bottom: 1px solid #f1f5f9;">${escapeHtml(vendorName)}</td>
        </tr>
      `);
    }
    if (paymentStructure) {
      summaryRows.push(`
        <tr>
          <td style="padding: 7px 12px; color: #64748b; font-size: 13px; font-weight: 500; border-bottom: 1px solid #f1f5f9;">Payment Terms:</td>
          <td style="padding: 7px 12px; color: #0f172a; font-size: 13px; font-weight: 600; text-transform: capitalize; border-bottom: 1px solid #f1f5f9;">${escapeHtml(paymentStructure.replace(/_/g, " ").toLowerCase())}</td>
        </tr>
      `);
    }
    if (amount !== undefined && amount !== null && amount !== "") {
      const formattedAmount = typeof amount === "number" ? amount.toLocaleString() : amount;
      summaryRows.push(`
        <tr>
          <td style="padding: 10px 12px; color: #0f172a; font-size: 13px; font-weight: 700; background-color: #f1f5f9;">Total Amount:</td>
          <td style="padding: 10px 12px; color: #059669; font-size: 16px; font-weight: 800; font-family: monospace; background-color: #f1f5f9;">${escapeHtml(currency || "QAR")} ${escapeHtml(formattedAmount)}</td>
        </tr>
      `);
    }

    const summaryCardHtml = summaryRows.length > 0 ? `
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 18px 0 24px 0; background-color: #ffffff; border-radius: 10px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.04);">
        <tbody>
          ${summaryRows.join("")}
        </tbody>
      </table>
    ` : "";

    // ── Specific Line Items Breakdown ────────────────────────────────────────
    let lineItemsHtml = "";
    if (items && Array.isArray(items) && items.length > 0) {
      const itemRows = items.map((item, idx) => {
        const itemQty = item.quantity || 1;
        const itemCost = item.estimatedCost || 0;
        const subtotal = itemQty * itemCost;
        const itemShortcut = requestId
          ? `${baseRequestUrl}?itemIndex=${idx}#item-${idx}`
          : baseRequestUrl;

        return `
          <tr style="border-bottom: 1px solid #f1f5f9; ${idx % 2 === 1 ? 'background-color: #f8fafc;' : ''}">
            <td style="padding: 10px 10px; font-size: 12px; color: #64748b; font-family: monospace; text-align: center; width: 28px;">
              ${idx + 1}
            </td>
            <td style="padding: 10px 10px; font-size: 13px; color: #0f172a;">
              <div style="font-weight: 600;">${escapeHtml(item.name || "Item")}</div>
              ${item.description || item.remarks ? `<div style="font-size: 11px; color: #64748b; margin-top: 2px;">${escapeHtml(item.description || item.remarks)}</div>` : ""}
            </td>
            <td style="padding: 10px 10px; font-size: 13px; color: #0f172a; text-align: center; font-family: monospace; font-weight: 600;">
              ${itemQty}
            </td>
            <td style="padding: 10px 10px; font-size: 13px; color: #0f172a; text-align: right; font-family: monospace;">
              ${itemCost.toLocaleString()}
            </td>
            <td style="padding: 10px 10px; font-size: 13px; color: #0f172a; text-align: right; font-family: monospace; font-weight: 700;">
              ${subtotal.toLocaleString()}
            </td>
            <td style="padding: 10px 10px; text-align: center; width: 70px;">
              <a href="${escapeHtml(itemShortcut)}" style="display: inline-block; font-size: 11px; font-weight: 600; color: #2563eb; text-decoration: none; background-color: #eff6ff; padding: 4px 8px; border-radius: 6px; border: 1px solid #bfdbfe;">
                Inspect &rarr;
              </a>
            </td>
          </tr>
        `;
      }).join("");

      lineItemsHtml = `
        <div style="margin: 24px 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #475569;">
              Requested Line Items (${items.length})
            </span>
            <a href="${escapeHtml(shortcuts?.itemsUrl || `${baseRequestUrl}#line-items`)}" style="font-size: 11px; color: #2563eb; text-decoration: none; font-weight: 600;">
              View all in app &rarr;
            </a>
          </div>
          <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse: collapse; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;">
            <thead>
              <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b;">
                <th style="padding: 8px 10px; text-align: center;">#</th>
                <th style="padding: 8px 10px; text-align: left;">Item</th>
                <th style="padding: 8px 10px; text-align: center;">Qty</th>
                <th style="padding: 8px 10px; text-align: right;">Unit (${currency || 'QAR'})</th>
                <th style="padding: 8px 10px; text-align: right;">Total</th>
                <th style="padding: 8px 10px; text-align: center;">Jump</th>
              </tr>
            </thead>
            <tbody>
              ${itemRows}
            </tbody>
          </table>
        </div>
      `;
    }

    // ── 1-Click Interactive Action Buttons (for Approvers) ───────────────────
    let actionsHtml = "";
    if (actions && actions.approveUrl) {
      actionsHtml = `
        <div style="margin: 28px 0; padding: 22px; background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 14px; border: 1px solid #cbd5e1; text-align: center;">
          <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: #0f172a; margin-bottom: 6px;">
            1-Click Decision Portal
          </div>
          <p style="font-size: 13px; color: #64748b; margin: 0 0 18px 0;">
            Sign off or return this request directly from your inbox:
          </p>

          <table width="100%" border="0" cellspacing="0" cellpadding="0">
            <tr>
              <td align="center">
                <table border="0" cellspacing="0" cellpadding="0">
                  <tr>
                    <!-- Approve Button -->
                    <td style="padding: 0 6px;">
                      <a href="${escapeHtml(actions.approveUrl)}" style="display: inline-block; background-color: #059669; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 24px; border-radius: 10px; letter-spacing: 0.02em; box-shadow: 0 4px 8px rgba(5, 150, 105, 0.25);">
                        ✓ Approve Request
                      </a>
                    </td>

                    <!-- Reject Button -->
                    <td style="padding: 0 6px;">
                      <a href="${escapeHtml(actions.rejectUrl)}" style="display: inline-block; background-color: #e11d48; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 20px; border-radius: 10px; letter-spacing: 0.02em; box-shadow: 0 4px 8px rgba(225, 29, 72, 0.25);">
                        ✕ Reject
                      </a>
                    </td>

                    <!-- Request Changes Button -->
                    <td style="padding: 0 6px;">
                      <a href="${escapeHtml(actions.changesUrl)}" style="display: inline-block; background-color: #ea580c; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 18px; border-radius: 10px; letter-spacing: 0.02em; box-shadow: 0 4px 8px rgba(234, 88, 12, 0.25);">
                        💬 Request Changes
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <p style="margin: 14px 0 0 0; font-size: 11px; color: #94a3b8;">
            Protected by signed cryptographic token. Clicking securely verifies your identity and records your decision.
          </p>
        </div>
      `;
    }

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #0f172a;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 30px 12px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 620px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
          <!-- Top Navy Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 24px 32px; border-bottom: 3px solid #3b82f6;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="color: #ffffff; font-size: 18px; font-weight: 800; letter-spacing: -0.02em; text-transform: uppercase;">
                      PURCHASE<span style="color: #38bdf8;">TRACKER</span>
                    </div>
                    <div style="color: #94a3b8; font-size: 11px; font-weight: 500; letter-spacing: 0.05em; text-transform: uppercase; margin-top: 2px;">
                      Enterprise Procurement & Approvals
                    </div>
                  </td>
                  <td align="right">
                    <span style="color: #cbd5e1; font-size: 11px; font-family: monospace; background-color: rgba(255,255,255,0.1); padding: 4px 10px; border-radius: 9999px;">
                      ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Email Body -->
          <tr>
            <td style="padding: 28px 32px;">
              <!-- Navigation Quick Jump Bar -->
              ${navShortcuts}

              <!-- Status Badges -->
              <div style="margin-bottom: 14px;">
                <span style="display: inline-block; background-color: ${badgeBg}; color: ${badgeColor}; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 9999px; letter-spacing: 0.04em; text-transform: uppercase; border: 1px solid ${badgeColor}30;">
                  ${badgeText}
                </span>
                ${priorityBadge}
              </div>

              <!-- Title -->
              <h1 style="margin: 0 0 14px 0; color: #0f172a; font-size: 20px; font-weight: 800; line-height: 1.35; letter-spacing: -0.01em;">
                ${escapeHtml(title)}
              </h1>

              <!-- Greeting & Message -->
              <p style="margin: 0 0 12px 0; color: #334155; font-size: 14px; line-height: 1.6;">
                Hello${userName ? ` <strong>${escapeHtml(userName)}</strong>` : ""},
              </p>

              <p style="margin: 0 0 16px 0; color: #334155; font-size: 14px; line-height: 1.6;">
                ${escapeHtml(message)}
              </p>

              <!-- Request Summary Card -->
              ${summaryCardHtml}

              <!-- Specific Line Items Breakdown -->
              ${lineItemsHtml}

              <!-- 1-Click Action Buttons Portal -->
              ${actionsHtml}

              <!-- Secondary Full Review CTA -->
              ${actionUrl ? `
                <div style="margin: 20px 0 10px 0; text-align: center;">
                  <a href="${escapeHtml(actionUrl)}" style="display: inline-block; color: #2563eb; text-decoration: none; font-size: 13px; font-weight: 700; padding: 10px 20px; border-radius: 8px; background-color: #eff6ff; border: 1px solid #bfdbfe;">
                    Open Full Request in PurchaseTracker &rarr;
                  </a>
                </div>
              ` : ""}

              <p style="margin: 24px 0 0 0; color: #64748b; font-size: 12px; line-height: 1.5; text-align: center;">
                For procurement policy or audit inquiries, coordinate with your departmental finance officer.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 32px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0 0 6px 0; color: #64748b; font-size: 12px;">
                You received this notification because email alerts are enabled for your account.
              </p>
              <p style="margin: 0; color: #94a3b8; font-size: 11px;">
                <a href="${escapeHtml(preferencesUrl)}" style="color: #2563eb; text-decoration: underline; font-weight: 600;">
                  Manage Notification Preferences
                </a>
                &bull; Delivered securely via Resend
              </p>
            </td>
          </tr>
        </table>
        
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 620px; margin-top: 14px;">
          <tr>
            <td align="center" style="color: #94a3b8; font-size: 11px;">
              &copy; ${new Date().getFullYear()} PurchaseTracker. Enterprise Systems. All rights reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }
}

function escapeHtml(str: any): string {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export const emailService = EmailService.getInstance();
