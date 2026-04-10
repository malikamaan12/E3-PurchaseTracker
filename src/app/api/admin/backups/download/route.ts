import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { R2Storage } from "@/lib/storage/r2";

/**
 * GET /api/admin/backups/download
 * Generates a secure, short-lived presigned URL for institutional backup retrieval.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user || user.role.toLowerCase() !== "admin") {
      return NextResponse.json({ error: "Access Denied" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");

    if (!key) {
      return NextResponse.json({ error: "Backup reference missing" }, { status: 400 });
    }

    // Generate 1-hour signed URL from R2
    const downloadUrl = await R2Storage.getDownloadUrl(key);

    // Redirect user to the secure storage endpoint
    return NextResponse.redirect(downloadUrl);

  } catch (error) {
    console.error("[BACKUP_DOWNLOAD] Error:", error);
    return NextResponse.json({ error: "Vault authorization failed" }, { status: 500 });
  }
}
