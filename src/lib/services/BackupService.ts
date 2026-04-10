import { db } from "@db";
import { 
  purchaseRequests, 
  vendors, 
  paymentInstallments, 
  fileAttachments 
} from "@db/schema";
import * as XLSX from "xlsx";
import { R2Storage } from "../storage/r2";
import { GoogleDriveStorage } from "../storage/google-drive";

/**
 * BackupService
 * Comprehensive data extraction and cloud distribution engine.
 */
export class BackupService {
  /**
   * Generates a multi-sheet Excel workbook from core institutional entities.
   */
  public static async generateExcelBackup(): Promise<Buffer> {
    console.log("[BackupService] Extracting institutional data...");

    // 1. Fetch Data
    const reqs = await db.select().from(purchaseRequests);
    const vends = await db.select().from(vendors);
    const payments = await db.select().from(paymentInstallments);
    const attachments = await db.select().from(fileAttachments);

    // 2. Transmute to Worksheets
    const ws_requests = XLSX.utils.json_to_sheet(reqs);
    const ws_vendors = XLSX.utils.json_to_sheet(vends);
    const ws_payments = XLSX.utils.json_to_sheet(payments);
    const ws_attachments = XLSX.utils.json_to_sheet(attachments);

    // 3. Assemble Workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws_requests, "Requests");
    XLSX.utils.book_append_sheet(wb, ws_vendors, "Vendors");
    XLSX.utils.book_append_sheet(wb, ws_payments, "Payment Installments");
    XLSX.utils.book_append_sheet(wb, ws_attachments, "Compliance Assets");

    // 4. Write to Buffer
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return buffer as Buffer;
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
      // In a production scenario, we would trigger an SMS/Email alert here.
      throw error;
    }
  }
}
