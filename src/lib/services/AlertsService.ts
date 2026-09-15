import { SettingsService } from "./SettingsService";

export interface SystemAlert {
  id: string;
  title: string;
  message: string;
  category: "system_update" | "compliance" | "maintenance" | "general";
  priority: "normal" | "important" | "urgent";
  active: boolean;
  linkUrl?: string | null;
  linkText?: string | null;
  createdAt: string;
  createdBy?: string | null;
  expiresAt?: string | null;
}

const SETTING_KEY = "system_broadcast_alerts";

const DEFAULT_ALERTS: SystemAlert[] = [
  {
    id: "default-compliance-rule",
    title: "Procurement Compliance Notice",
    message: "Commercial requests above QAR 50,000 require Department Head & Finance dual approval before PO issuance.",
    category: "compliance",
    priority: "important",
    active: true,
    linkUrl: "/dashboard/requests",
    linkText: "View Workflow",
    createdAt: new Date().toISOString(),
    createdBy: "System Policy",
    expiresAt: null,
  }
];

export class AlertsService {
  /**
   * Retrieve all alerts (admin view, includes inactive & expired)
   */
  static async getAllAlerts(): Promise<SystemAlert[]> {
    try {
      const alerts = await SettingsService.getSetting<SystemAlert[]>(SETTING_KEY);
      if (!alerts || !Array.isArray(alerts) || alerts.length === 0) {
        // Seed default initial alert once so admins have a template to view
        await SettingsService.setSetting(SETTING_KEY, DEFAULT_ALERTS);
        return DEFAULT_ALERTS;
      }
      return alerts;
    } catch (err) {
      console.error("[AlertsService] Failed to load alerts:", err);
      return DEFAULT_ALERTS;
    }
  }

  /**
   * Retrieve only active, non-expired alerts for end-user ticker display
   */
  static async getActiveAlerts(): Promise<SystemAlert[]> {
    const all = await this.getAllAlerts();
    const now = new Date();

    return all.filter((alert) => {
      if (!alert.active) return false;
      if (alert.expiresAt) {
        const exp = new Date(alert.expiresAt);
        if (!isNaN(exp.getTime()) && exp <= now) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Create or update a system broadcast alert
   */
  static async saveAlert(alertData: Partial<SystemAlert> & { title: string; message: string }, userId?: number): Promise<SystemAlert> {
    const all = await this.getAllAlerts();
    const id = alertData.id || `alert_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const newAlert: SystemAlert = {
      id,
      title: alertData.title.trim(),
      message: alertData.message.trim(),
      category: alertData.category || "system_update",
      priority: alertData.priority || "normal",
      active: alertData.active !== undefined ? alertData.active : true,
      linkUrl: alertData.linkUrl ? alertData.linkUrl.trim() : null,
      linkText: alertData.linkText ? alertData.linkText.trim() : null,
      createdAt: alertData.createdAt || new Date().toISOString(),
      createdBy: alertData.createdBy || (userId ? `User #${userId}` : "Admin"),
      expiresAt: alertData.expiresAt ? new Date(alertData.expiresAt).toISOString() : null,
    };

    const existingIndex = all.findIndex((a) => a.id === id);
    let updatedList: SystemAlert[];

    if (existingIndex >= 0) {
      updatedList = [...all];
      updatedList[existingIndex] = { ...all[existingIndex], ...newAlert };
    } else {
      updatedList = [newAlert, ...all];
    }

    await SettingsService.setSetting(SETTING_KEY, updatedList, userId);
    return newAlert;
  }

  /**
   * Toggle active state of an alert
   */
  static async toggleAlertActive(id: string, active: boolean, userId?: number): Promise<SystemAlert | null> {
    const all = await this.getAllAlerts();
    const target = all.find((a) => a.id === id);
    if (!target) return null;

    target.active = active;
    await SettingsService.setSetting(SETTING_KEY, all, userId);
    return target;
  }

  /**
   * Delete an alert
   */
  static async deleteAlert(id: string, userId?: number): Promise<boolean> {
    const all = await this.getAllAlerts();
    const filtered = all.filter((a) => a.id !== id);
    if (filtered.length === all.length) return false;

    await SettingsService.setSetting(SETTING_KEY, filtered, userId);
    return true;
  }
}
