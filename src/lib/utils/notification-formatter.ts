import { formatDistanceToNow } from "date-fns";

export interface CleanNotification {
  id: number;
  title: string;
  message: string;
  link: string;
  type: string;
  priority: string;
  isRead: boolean;
  createdAt: string | Date;
  requestId?: number | null;
}

const TYPE_TITLE_MAP: Record<string, string> = {
  purchase_request_submitted: "Request Submitted",
  purchase_request_approved: "Request Approved",
  purchase_request_rejected: "Request Rejected",
  purchase_request_changes_requested: "Changes Requested",
  purchase_request_updated: "Request Updated",
  purchase_request_canceled: "Request Canceled",
  purchase_request_completed: "Request Completed",
  approval_required: "Approval Required",
  approval_reminder: "Approval Reminder",
  approval_delegated: "Approval Delegated",
  approval_overridden: "Approval Overridden",
  vendor_created: "New Vendor Created",
  vendor_updated: "Vendor Updated",
  vendor_deactivated: "Vendor Deactivated",
  account_created: "Account Created",
  account_updated: "Account Updated",
  password_reset: "Password Reset",
  system_maintenance: "System Maintenance",
  system_update: "System Update",
  system_error: "System Diagnostic Alert",
};

/**
 * Resolves a safe navigation link for any notification, avoiding broken {id} placeholders.
 */
export function resolveNotificationLink(notif: any): string {
  if (!notif) return "/dashboard/requests";

  let link: string = notif.link || "";

  // Check for unresolved placeholders or empty targets
  if (!link || link.includes("{id}") || link.includes("{requestId}") || link.endsWith("/requests/")) {
    if (notif.requestId) {
      return `/dashboard/requests/${notif.requestId}`;
    }
    if (notif.type?.startsWith("vendor_")) {
      return "/dashboard/vendors";
    }
    if (notif.type?.startsWith("system_error")) {
      return "/dashboard/admin/diagnostics";
    }
    return "/dashboard/requests";
  }

  // Ensure /dashboard prefix for internal relative routes
  if (link.startsWith("/") && !link.startsWith("/dashboard") && !link.startsWith("/login") && !link.startsWith("/signup") && !link.startsWith("/vendor/")) {
    link = `/dashboard${link}`;
  }

  return link;
}

/**
 * Formats a raw notification title into a clean human-readable string.
 */
export function formatNotificationTitle(notif: any): string {
  if (!notif) return "System Notification";

  if (notif.title && typeof notif.title === "string" && notif.title.trim().length > 0) {
    const trimmed = notif.title.trim();
    // If title is raw snake_case, format it
    if (trimmed.includes("_") && !trimmed.includes(" ")) {
      return TYPE_TITLE_MAP[trimmed] || trimmed
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c: string) => c.toUpperCase());
    }
    return trimmed;
  }

  if (notif.type && TYPE_TITLE_MAP[notif.type]) {
    return TYPE_TITLE_MAP[notif.type];
  }

  return "System Notification";
}

/**
 * Formats a raw notification message into a clean, human-readable sentence.
 */
export function formatNotificationMessage(notif: any): string {
  if (!notif) return "";

  let msg = notif.message;

  if (typeof msg !== "string") {
    if (msg && typeof msg === "object") {
      msg = msg.message || msg.error || JSON.stringify(msg);
    } else {
      msg = "";
    }
  }

  msg = msg.trim();

  // If the message is a raw JSON string, extract the message or error property
  if (msg.startsWith("{") && msg.endsWith("}")) {
    try {
      const parsed = JSON.parse(msg);
      msg = parsed.message || parsed.error || parsed.title || msg;
    } catch {
      // keep original
    }
  }

  // Clean unreplaced placeholder braces if any exist
  msg = msg.replace(/\{(\w+)\}/g, "$1");

  if (!msg) {
    const title = formatNotificationTitle(notif);
    return `You have an update regarding: ${title}`;
  }

  return msg;
}

/**
 * Safely formats timestamp to relative string.
 */
export function formatNotificationTime(date: any): string {
  if (!date) return "recently";
  try {
    const parsedDate = date instanceof Date ? date : new Date(date);
    if (isNaN(parsedDate.getTime())) return "recently";
    return formatDistanceToNow(parsedDate, { addSuffix: true });
  } catch {
    return "recently";
  }
}
