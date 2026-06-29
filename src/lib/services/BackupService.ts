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

    const fetchInChunks = async (tableDef: any) => {
      let offset = 0;
      const limit = 5000;
      const allRows: any[] = [];
      while (true) {
        const rows = await db.select().from(tableDef).limit(limit).offset(offset);
        if (rows.length === 0) break;
        allRows.push(...rows);
        offset += limit;
      }
      return allRows;
    };

    // 1. Fetch Data in chunks to prevent Drizzle ORM OOM
    const reqs = await fetchInChunks(purchaseRequests);
    const vends = await fetchInChunks(vendors);
    const payments = await fetchInChunks(paymentInstallments);
    const attachments = await fetchInChunks(fileAttachments);

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
      let r2Success = false;
      try {
        console.log("[BackupService] Uploading to Cloudflare R2...");
        await R2Storage.uploadBackup(buffer, fileName);
        r2Success = true;
      } catch (err) {
        console.error("[BackupService] R2 Upload Failed:", err);
      }

      // Step C: Google Drive Synchronization (Double Redundancy)
      let gdriveSuccess = false;
      try {
        console.log("[BackupService] Synchronizing with Google Drive (Dual Folders)...");
        await GoogleDriveStorage.uploadRedundant(buffer, fileName);
        gdriveSuccess = true;
      } catch (err) {
        console.error("[BackupService] Google Drive Upload Failed:", err);
      }

      if (!r2Success && !gdriveSuccess) {
        throw new Error("All backup destinations failed.");
      }

      console.log(`[BackupService] Backup ${fileName} FINISHED. R2: ${r2Success}, Drive: ${gdriveSuccess}`);
      return { success: true, fileName };
    } catch (error) {
      console.error("[BackupService] CRITICAL FAILURE in backup pipeline:", error);
      throw error;
    }
  }
}
