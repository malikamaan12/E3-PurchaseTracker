import { db } from "@db";
import { notifications } from "@db/schema";
import { AppError } from "./errors";

// Define valid notification types and their route patterns
export const NOTIFICATION_ROUTES = {
  request: (id: number) => `/requests/${id}`,
  account_request: () => '/admin/account-requests',
  system: () => '/',
  error_analytics: () => '/admin/error-analytics',
  default: () => '/'
} as const;

// Add logging to help track notification creation and routing
const logNotification = (action: string, data: any) => {
  console.log(`[Notification ${action}]:`, JSON.stringify(data, null, 2));
};

export async function createNotification(
  userId: number,
  title: string,
  message: string,
  type: string,
  requestId?: number
) {
  try {
    // Determine the correct link based on notification type
    let link: string | null = null;

    // Log the incoming notification data
    logNotification('create-params', { userId, title, message, type, requestId });

    if (type === 'request' && requestId) {
      link = NOTIFICATION_ROUTES.request(requestId);
    } else if (type === 'account_request') {
      link = NOTIFICATION_ROUTES.account_request();
    } else if (type === 'system') {
      link = NOTIFICATION_ROUTES.system();
    } else if (type === 'error_analytics') {
      link = NOTIFICATION_ROUTES.error_analytics();
    } else {
      link = NOTIFICATION_ROUTES.default();
    }

    // Log the resolved link
    logNotification('resolved-link', { type, link, requestId });

    const [notification] = await db
      .insert(notifications)
      .values({
        userId,
        title,
        message,
        type,
        requestId,
        link,
        isRead: false,
        createdAt: new Date(),
      })
      .returning();

    // Log the created notification
    logNotification('created', notification);

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw new AppError('Failed to create notification', 500, 'error');
  }
}

export async function cleanupUploads() {
  const uploadDir = 'uploads';
  const fs = await import('fs');
  const path = await import('path');

  if (!fs.existsSync(uploadDir)) return;

  fs.readdir(uploadDir, (err, files) => {
    if (err) {
      console.error('Error reading upload directory:', err);
      return;
    }

    const now = Date.now();
    files.forEach(file => {
      const filePath = path.join(uploadDir, file);
      fs.stat(filePath, (err, stats) => {
        if (err) {
          console.error(`Error getting stats for file ${file}:`, err);
          return;
        }

        // Remove files older than 24 hours
        if (now - stats.mtimeMs > 24 * 60 * 60 * 1000) {
          fs.unlink(filePath, err => {
            if (err) console.error(`Error deleting file ${file}:`, err);
          });
        }
      });
    });
  });
}