import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { r2Storage, isR2Configured } from "@/lib/services/R2StorageService";

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/pdf-settings/upload
 * Handles custom PNG branding uploads (Logo, Header, Footer) to Cloudflare R2.
 * Access: Admin only.
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await getAuthenticatedUser(req);
    if (!admin) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    if (admin.role !== 'super_admin') {
      return NextResponse.json({ error: "Access denied. Super Admin role required." }, { status: 403 });
    }

    if (!isR2Configured) {
      return NextResponse.json({ 
        error: "Storage not configured", 
        message: "Cloudflare R2 is not configured in the environment variables." 
      }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
    const ALLOWED_IMAGE_MIMES = new Set(["image/png", "image/jpeg", "image/webp"]);
    const ALLOWED_IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "webp"]);

    if (file.size > MAX_IMAGE_SIZE) {
      return NextResponse.json({ error: "Image file exceeds maximum allowed size of 5MB." }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!ALLOWED_IMAGE_EXTS.has(ext)) {
      return NextResponse.json({ error: `Image extension ".${ext}" is not permitted. Only PNG, JPG, JPEG, and WebP are allowed.` }, { status: 400 });
    }

    if (!ALLOWED_IMAGE_MIMES.has(file.type.toLowerCase())) {
      return NextResponse.json({ error: "Invalid file type. Only PNG, JPG, and WebP images are allowed." }, { status: 400 });
    }

    const sanitizedFileName = file.name
      .replace(/\.\.+/g, "")
      .replace(/[^a-zA-Z0-9._\- ]/g, "")
      .trim()
      .slice(0, 150) || "branding-image.png";

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Upload to R2
    const objectKey = await r2Storage.uploadAttachment(
      buffer,
      sanitizedFileName,
      file.type
    );

    // For public settings, we might want to return the presigned URL or the key
    // Usually for branding, we'll store the key and generate a presigned URL on the fly or use a public bucket.
    // For this context, we'll return the object key which will be stored in pdf_settings.
    
    const publicUrl = await r2Storage.getReadPresignedUrl(objectKey, 604800); // 7 days valid for preview

    return NextResponse.json({ 
      success: true, 
      objectKey, 
      publicUrl 
    });
  } catch (error: any) {
    console.error("[Native Admin API] Branding Upload Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
