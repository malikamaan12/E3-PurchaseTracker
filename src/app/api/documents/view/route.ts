import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { r2Storage, isR2Configured } from "@/lib/services/R2StorageService";
import { db } from "@db";
import { fileAttachments, purchaseRequests, approvals, vendorDocuments } from "@db/schema";
import { eq, or, ilike } from "drizzle-orm";
import { normalizeDepartmentAssignments } from "@/lib/auth-shared";

export const dynamic = "force-dynamic";

/**
 * Universal Document View Endpoint
 * Prevents S3 Presigned URL Expiration Errors (<Error><Code>ExpiredRequest</Code></Error>)
 * by dynamically extracting object keys and generating fresh 1-hour presigned URLs.
 * Enforces RBAC permissions to prevent Insecure Direct Object References (IDOR).
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

    // 1. If it's a local path (e.g. /uploads/...), sanitize and redirect directly
    if (rawUrl.startsWith("/uploads/")) {
      if (rawUrl.includes("..") || rawUrl.includes("\\")) {
        return NextResponse.json({ error: "Invalid path format" }, { status: 400 });
      }
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

    // 3. RBAC / IDOR Authorization Guard for Non-Admins
    const isAdmin = user.role === "admin" || user.role === "super_admin";
    if (!isAdmin) {
      // Check if this object key is an attachment on a purchase request
      const [attachment] = await db
        .select({
          id: fileAttachments.id,
          requestId: fileAttachments.requestId,
        })
        .from(fileAttachments)
        .where(
          or(
            eq(fileAttachments.fileUrl, rawUrl),
            ilike(fileAttachments.fileUrl, `%${objectKey}%`)
          )
        )
        .limit(1);

      if (attachment && attachment.requestId) {
        const [request] = await db
          .select({
            id: purchaseRequests.id,
            requesterId: purchaseRequests.requesterId,
            department: purchaseRequests.department,
            status: purchaseRequests.status,
          })
          .from(purchaseRequests)
          .where(eq(purchaseRequests.id, attachment.requestId))
          .limit(1);

        if (request) {
          const userDepts = (user.departments || [user.department])
            .filter(Boolean)
            .map((d: any) => (typeof d === "string" ? d : d.department || "").toLowerCase().trim());
          const reqDept = (request.department || "").toLowerCase().trim();
          const isDeptMember = userDepts.includes(reqDept);
          const isRequester = request.requesterId === user.id;

          // Check approver authority for non-department reviewers
          const approverDepts: string[] = [];
          if (user.role === "approver" && user.department) {
            approverDepts.push(user.department.toLowerCase().trim());
          }
          const normalizedAssignments = user.departmentAssignments || normalizeDepartmentAssignments(user.assignedDepartments, user.department);
          for (const assignment of normalizedAssignments) {
            if (assignment.status === "active" && (assignment.role === "approver" || assignment.role === "both")) {
              if (assignment.department) {
                approverDepts.push(assignment.department.toLowerCase().trim());
              }
            }
          }

          const reqApprovals = await db
            .select({ department: approvals.department, approverId: approvals.approverId })
            .from(approvals)
            .where(eq(approvals.requestId, request.id));

          const isApproverForReq = reqApprovals.some((a) =>
            a.approverId === user.id || (a.department && approverDepts.includes(a.department.toLowerCase().trim()))
          );

          if (!isRequester && !isDeptMember && !isApproverForReq) {
            return NextResponse.json(
              { error: "Access Denied", message: "You do not have permission to view documents for this request." },
              { status: 403 }
            );
          }
        }
      }
    }

    // 4. Generate fresh 1-hour signed URL if R2 storage is active
    let freshSignedUrl: string | null = null;
    if (isR2Configured && objectKey) {
      try {
        freshSignedUrl = await r2Storage.getReadPresignedUrl(objectKey, 3600);
      } catch (err: any) {
        console.error("[Document View API] Presign Refresh Error:", err);
      }
    }

    if (freshSignedUrl) {
      return NextResponse.redirect(freshSignedUrl);
    }

    // 4. Safe destination check for non-R2 environments (prevent arbitrary open redirect)
    try {
      const parsed = new URL(rawUrl, req.url);
      const reqOrigin = new URL(req.url).origin;
      const isSameOrigin = parsed.origin === reqOrigin;
      const isAllowedS3Host = parsed.hostname.endsWith(".r2.cloudflarestorage.com") || parsed.hostname.endsWith(".amazonaws.com");

      if (isSameOrigin || isAllowedS3Host || rawUrl.startsWith("/uploads/")) {
        return NextResponse.redirect(parsed.toString());
      }
    } catch {
      // Invalid URL format
    }

    return NextResponse.json({ error: "Invalid document destination" }, { status: 400 });
  } catch (error: any) {
    console.error("[Document View API] Server Error:", error);
    return NextResponse.json({ error: "Failed to resolve document preview" }, { status: 500 });
  }
}
