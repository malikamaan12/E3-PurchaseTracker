import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { fileAttachments } from "@db/schema";
import { eq } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { r2Storage } from "@/lib/services/R2StorageService";

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: paramId } = await params;
    const user = await getAuthenticatedUser(req);
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const attachmentId = parseInt(paramId);
    if (isNaN(attachmentId)) {
      return NextResponse.json({ error: "Invalid attachment ID" }, { status: 400 });
    }

    const [attachment] = await db
      .select()
      .from(fileAttachments)
      .where(eq(fileAttachments.id, attachmentId))
      .limit(1);

    if (!attachment) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    let redirectUrl = attachment.fileUrl;
    
    // If it's an object key (doesn't start with http), generate a presigned URL
    if (!redirectUrl.startsWith("http")) {
       try {
         redirectUrl = await r2Storage.getReadPresignedUrl(redirectUrl, 3600);
       } catch (e) {
         console.error("Failed to generate presigned URL", e);
       }
    } else {
       // It's a legacy presigned URL. Try to extract the object key and regenerate if possible.
       try {
         const urlWithoutQuery = redirectUrl.split("?")[0];
         const matchIndex = urlWithoutQuery.indexOf("attachments/");
         if (matchIndex !== -1) {
            // S3 URL encodes the key. So we decodeURI to get the original key
            const extractedKey = decodeURIComponent(urlWithoutQuery.substring(matchIndex));
            redirectUrl = await r2Storage.getReadPresignedUrl(extractedKey, 3600);
         }
       } catch (e) {
         console.error("Failed to refresh legacy URL", e);
       }
    }

    // Redirect the browser/iframe to the presigned R2 URL
    return NextResponse.redirect(redirectUrl);

  } catch (error: any) {
    console.error("[Attachment API] Fetch Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
