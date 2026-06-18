import { db } from "@db";
import { 
  purchaseRequests, 
  vendors, 
  paymentInstallments, 
  fileAttachments 
} from "@db/schema";
import ExcelJS from "exceljs";
import { R2Storage } from "../storage/r2";
import { GoogleDriveStorage } from "../storage/google-drive";

/**
 * BackupService
 * Comprehensive data extraction and cloud distribution engine.
 */
export class BackupService {
  /**
   * Generates a multi-sheet Excel workbook from core institutional entities.
   * Migrated from xlsx (abandoned, critically vulnerable) to exceljs.
   */
  public static async generateExcelBackup(): Promise<Buffer> {
    console.log("[BackupService] Extracting institutional data...");

    // 1. Fetch Data
    const reqs = await db.select().from(purchaseRequests);
    const vends = await db.select().from(vendors);
    const payments = await db.select().from(paymentInstallments);
    const attachments = await db.select().from(fileAttachments);

    // 2. Build Workbook
    const wb = new ExcelJS.Workbook();

    const addSheet = (name: string, rows: Record<string, any>[]) => {
      const ws = wb.addWorksheet(name);
      if (rows.length === 0) return;
      // Use first row keys as headers
      const headers = Object.keys(rows[0]);
      ws.addRow(headers);
      for (const row of rows) {
        ws.addRow(headers.map((h) => row[h] ?? ""));
      }
    };

    addSheet("Requests", reqs as any[]);
    addSheet("Vendors", vends as any[]);
    addSheet("Payment Installments", payments as any[]);
    addSheet("Compliance Assets", attachments as any[]);

    // 3. Write to Buffer
    const arrayBuffer = await wb.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Complete Enterprise Backup Orchestration
   * Extends Fault Tolerance: R2 -> Drive 1 -> Drive 2
   */
  public static async runBackupJob(isManual = false) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `PT_Backup_${timestamp}.xlsx`;
    
    console.log(`[BackupService] Initializing ${isManual ? "Manual" : "Automated"} Backup Job: ${fileName}`);

    try {
      // Step A: Generate Bundle
      const buffer = await this.generateExcelBackup();

      // Step B: R2 Persistence (Primary Vault)
      console.log("[BackupService] Uploading to Cloudflare R2...");
      await R2Storage.uploadBackup(buffer, fileName);

      // Step C: Google Drive Synchronization (Double Redundancy)
      console.log("[BackupService] Synchronizing with Google Drive (Dual Folders)...");
      await GoogleDriveStorage.uploadRedundant(buffer, fileName);

      console.log(`[BackupService] Backup ${fileName} SUCCESSFULLY DEPLOYED across all institutional vaults.`);
      return { success: true, fileName };
    } catch (error) {
      console.error("[BackupService] CRITICAL FAILURE in backup pipeline:", error);
      throw error;
    }
  }
}
