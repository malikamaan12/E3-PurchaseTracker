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

    const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB
    const MAX_FILES_PER_BATCH = 10;
    const ALLOWED_EXTENSIONS = new Set(["pdf", "png", "jpg", "jpeg", "docx", "xlsx", "csv"]);
    const ALLOWED_MIME_TYPES = new Set([
      "application/pdf",
      "image/png",
      "image/jpeg",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/csv"
    ]);

    if (files.length > MAX_FILES_PER_BATCH) {
      return NextResponse.json({ error: `Maximum ${MAX_FILES_PER_BATCH} files allowed per upload.` }, { status: 400 });
    }

    const sanitizeFileName = (name: string): string => {
      return name
        .replace(/\.\.+/g, "")
        .replace(/[^a-zA-Z0-9._\- ]/g, "")
        .trim()
        .slice(0, 150) || "attachment";
    };

    const uploadedRecords = [];

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: `File "${file.name}" exceeds maximum allowed size of 15MB.` }, { status: 400 });
      }

      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        return NextResponse.json({ error: `File extension ".${ext}" is not permitted.` }, { status: 400 });
      }

      if (!ALLOWED_MIME_TYPES.has(file.type.toLowerCase())) {
        return NextResponse.json({ error: `MIME type "${file.type}" is not permitted.` }, { status: 400 });
      }

      const sanitizedName = sanitizeFileName(file.name);
      const buffer = Buffer.from(await file.arrayBuffer());
      
      // 1. Upload to Cloudflare R2
      const objectKey = await r2Storage.uploadAttachment(
        buffer,
        sanitizedName,
        file.type
      );

      // 2. Generate Public URL (Expiring for security)
      const fileUrl = await r2Storage.getReadPresignedUrl(objectKey, 604800); // 7 days

      // 3. Persist Metadata to Database (requestId is now optional)
      const [record] = await db.insert(fileAttachments).values({
        fileName: sanitizedName,
        fileType: file.type,
        fileSize: file.size,
        fileUrl: objectKey, // Storing objectKey so we can generate fresh URLs later
      }).returning();
      
      // Return the presigned url so the frontend can preview it immediately
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

