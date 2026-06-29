export const maxDuration = 60;
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { r2Storage, isR2Configured } from "@/lib/services/R2StorageService";
import { db } from "@db";
import { fileAttachments } from "@db/schema";

export const dynamic = 'force-dynamic';

/**
 * POST /api/attachments/upload
 * Native upload handler for Purchase Request supporting documents.
 * High-performance Cloudflare R2 integration with Drizzle metadata persistence.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isR2Configured) {
      return NextResponse.json({ 
        error: "Storage not configured", 
        message: "Cloudflare R2 is not configured. File uploads are disabled." 
      }, { status: 500 });
    }

    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const uploadedRecords = [];

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      
      // 1. Upload to Cloudflare R2
      const objectKey = await r2Storage.uploadAttachment(
        buffer,
        file.name,
        file.type
      );

      // 2. Generate Public URL (Expiring for security)
      // We don't store this in the DB, we generate it on the fly when requested.
      const fileUrl = await r2Storage.getReadPresignedUrl(objectKey, 604800); // 7 days

      // 3. Persist Metadata to Database (requestId is now optional)
      const [record] = await db.insert(fileAttachments).values({
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        fileUrl: objectKey, // Storing objectKey so we can generate fresh URLs later
      }).returning();
      
      // But return the presigned url so the frontend can preview it immediately if it wants
      uploadedRecords.push({ ...record, fileUrl });
    }

    return NextResponse.json(uploadedRecords);
  } catch (error: any) {
    console.error("[Attachment API] Upload Critical Error:", error);
    return NextResponse.json({ 
      error: "Upload process failed", 
      details: error.message 
    }, { status: 500 });
  }
}

