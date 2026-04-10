import { NextRequest, NextResponse } from "next/server";
import { BackupService } from "@/lib/services/BackupService";

/**
 * GET /api/cron/daily-backup
 * Automated institutional backup trigger.
 * Protected by CRON_SECRET header to prevent unauthorized extraction.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    
    // Verify Vercel Cron Secret
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.warn("[CRON_BACKUP] Unauthorized attempt detected.");
      return NextResponse.json({ error: "Access Denied" }, { status: 401 });
    }

    console.log("[CRON_BACKUP] Triggering daily institutional snapshot...");
    
    // In a cron route, we can await the result directly as they have higher timeout limits (up to 5 mins on Vercel Pro)
    // or use waitUntil if it's very large. 
    await BackupService.runBackupJob(false);

    return NextResponse.json({ 
      success: true, 
      message: "Daily backup completed and distributed." 
    });

  } catch (error: any) {
    console.error("[CRON_BACKUP] Error:", error);
    return NextResponse.json({ error: "Pipeline failure during automated backup" }, { status: 500 });
  }
}
