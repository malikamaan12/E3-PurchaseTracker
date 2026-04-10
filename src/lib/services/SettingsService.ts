import { db } from "@db";
import { systemSettings } from "@db/schema";
import { eq } from "drizzle-orm";

/**
 * SettingsService
 * Handles persistence and retrieval of dynamic system configurations.
 */
export class SettingsService {
  /**
   * Fetches a specific setting by key.
   */
  static async getSetting<T = any>(key: string): Promise<T | null> {
    try {
      const [setting] = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, key))
        .limit(1);

      return setting ? (setting.value as T) : null;
    } catch (error) {
      console.error(`[SettingsService] Failed to fetch setting ${key}:`, error);
      return null;
    }
  }

  /**
   * Persists or updates a setting.
   */
  static async setSetting(key: string, value: any, userId?: number) {
    try {
      const existing = await this.getSetting(key);

      if (existing !== null) {
        await db
          .update(systemSettings)
          .set({ 
            value, 
            updatedAt: new Date(),
            updatedBy: userId 
          })
          .where(eq(systemSettings.key, key));
      } else {
        await db
          .insert(systemSettings)
          .values({
            key,
            value,
            updatedBy: userId,
            updatedAt: new Date()
          });
      }
      return true;
    } catch (error) {
      console.error(`[SettingsService] Failed to save setting ${key}:`, error);
      throw error;
    }
  }
}
