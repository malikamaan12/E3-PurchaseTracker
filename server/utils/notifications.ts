import { db } from "@db";
import { notifications } from "@db/schema";
import { AppError } from "./errors";

// Define valid notification types and their route patterns
const NOTIFICATION_ROUTES = {
  request: (id: number) => `/requests/${id}`,
  account_request: () => '/admin/account-requests',
  system: () => '/',
  default: () => '/'
} as const;

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

    if (type === 'request' && requestId) {
      link = NOTIFICATION_ROUTES.request(requestId);
    } else if (type === 'account_request') {
      link = NOTIFICATION_ROUTES.account_request();
    } else if (type === 'system') {
      link = NOTIFICATION_ROUTES.system();
    } else {
      link = NOTIFICATION_ROUTES.default();
    }

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