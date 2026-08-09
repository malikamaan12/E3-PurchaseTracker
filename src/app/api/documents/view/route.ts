import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { r2Storage, isR2Configured } from "@/lib/services/R2StorageService";

export const dynamic = "force-dynamic";

/**
 * Universal Document View Endpoint
 * Prevents S3 Presigned URL Expiration Errors (<Error><Code>ExpiredRequest</Code></Error>)
 * by dynamically extracting object keys and generating fresh 1-hour presigned URLs.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const rawUrl = searchParams.get("url");

    if (!rawUrl) {
      return NextResponse.json({ error: "Document URL parameter missing" }, { status: 400 });
    }

    // 1. If it's a local path (e.g. /uploads/...), return/redirect directly
    if (rawUrl.startsWith("/uploads/") || rawUrl.startsWith("http://localhost")) {
      return NextResponse.redirect(new URL(rawUrl, req.url));
    }

    // 2. Extract Object Key from S3 / R2 presigned or static URL
    let objectKey = rawUrl;
    
    // Remove any existing query string (e.g., expired X-Amz-Signature params)
    const urlWithoutQuery = rawUrl.split("?")[0];

    if (urlWithoutQuery.includes("attachments/")) {
      const matchIndex = urlWithoutQuery.indexOf("attachments/");
      objectKey = decodeURIComponent(urlWithoutQuery.substring(matchIndex));
    } else if (urlWithoutQuery.includes("vendor-documents/")) {
      const matchIndex = urlWithoutQuery.indexOf("vendor-documents/");
      objectKey = decodeURIComponent(urlWithoutQuery.substring(matchIndex));
    } else if (urlWithoutQuery.startsWith("http")) {
      try {
        const parsedUrl = new URL(urlWithoutQuery);
        // Strip leading slash if any
        objectKey = decodeURIComponent(parsedUrl.pathname.replace(/^\//, ""));
      } catch (e) {
        console.error("[Document View API] Failed to parse URL pathname", e);
      }
    }

    // 3. Generate fresh 1-hour signed URL if R2 storage is active
    let freshSignedUrl = rawUrl;
    if (isR2Configured && objectKey) {
      try {
        freshSignedUrl = await r2Storage.getReadPresignedUrl(objectKey, 3600);
      } catch (err: any) {
        console.error("[Document View API] Presign Refresh Error:", err);
      }
    }

    return NextResponse.redirect(freshSignedUrl);
  } catch (error: any) {
    console.error("[Document View API] Server Error:", error);
    return NextResponse.json({ error: "Failed to resolve document preview" }, { status: 500 });
  }
}
