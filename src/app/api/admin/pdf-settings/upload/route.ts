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

    if (admin.role !== 'admin') {
      return NextResponse.json({ error: "Access denied. Admin only route." }, { status: 403 });
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

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Invalid file type. Only images are allowed." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Upload to R2
    const objectKey = await r2Storage.uploadAttachment(
      buffer,
      file.name,
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
