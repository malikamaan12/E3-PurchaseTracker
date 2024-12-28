import { db } from "@db";
import { notifications } from "@db/schema";
import { AppError } from "./errors";

export async function createNotification(
  userId: number,
  title: string,
  message: string,
  type: string,
  requestId?: number
) {
  try {
    const [notification] = await db
      .insert(notifications)
      .values({
        userId,
        title,
        message,
        type,
        requestId,
        link: requestId ? `/requests/${requestId}` : null,
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
