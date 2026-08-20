import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { purchaseRequests, pdfSettings } from "@db/schema";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { normalizeDepartmentAssignments } from "@/lib/auth-shared";
import { generatePurchaseRequestPdf } from "@/lib/pdf/RequestPdfGenerator";
import { fetchPdfAssetBuffer } from "@/lib/pdf/image-loader";

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function getFullRequestData(requestId: number) {
  return await db.query.purchaseRequests.findFirst({
    where: (pr, { eq }) => eq(pr.id, requestId),
    with: {
      requester: true,
      vendor: true,
      subPurpose: true,
      attachments: true,
      installments: true, 
      approvals: {
        with: {
          approver: {
            columns: { username: true }
          }
        }
      }
    }
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: paramId } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const requestId = parseInt(paramId);
    if (isNaN(requestId)) return NextResponse.json({ error: "Invalid request ID" }, { status: 400 });

    const requestData = await getFullRequestData(requestId) as any;
    if (!requestData) return NextResponse.json({ error: "Request not found" }, { status: 404 });

    const isSuperAdmin = user.role === "super_admin";
    const isAdmin = user.role === "admin" || isSuperAdmin;
    const userDepts = (user.departments || [user.department])
      .filter(Boolean)
      .map((d: any) => (typeof d === "string" ? d : d.department || "").toLowerCase().trim());
    const reqDept = (requestData.department || requestData.requester?.department || "").toLowerCase().trim();
    const isDeptMember = userDepts.includes(reqDept);
    const isRequester = requestData.requesterId === user.id;

    // Check if user is an authorized approver for any approval slot on this request
    const approverDepts: string[] = [];
    if (user.role === 'approver' && user.department) {
      approverDepts.push(user.department.toLowerCase().trim());
    }
    const normalizedAssignments = user.departmentAssignments || normalizeDepartmentAssignments(user.assignedDepartments, user.department);
    for (const assignment of normalizedAssignments) {
      if (assignment.status === 'active' && (assignment.role === 'approver' || assignment.role === 'both')) {
        if (assignment.department) {
          approverDepts.push(assignment.department.toLowerCase().trim());
        }
      }
    }

    const isApproverForReq = (requestData.approvals || []).some((a: any) =>
      a.approverId === user.id || (a.department && approverDepts.includes(a.department.toLowerCase().trim()))
    );

    const canView = isAdmin || isRequester || isDeptMember || isApproverForReq;
    if (!canView) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const settingsResult = await db.select().from(pdfSettings).limit(1);
    const settings = settingsResult[0] || null;

    const [headerImage, footerImage, logo] = await Promise.all([
      fetchPdfAssetBuffer(settings?.headerImage || null, req.url),
      fetchPdfAssetBuffer(settings?.footerImage || null, req.url),
      fetchPdfAssetBuffer(settings?.logo || null, req.url)
    ]);

    const pdfBytes = await generatePurchaseRequestPdf(requestData, {
      headerImage,
      footerImage,
      logo,
      headerTitle: settings?.headerTitle,
      headerSubtitle: settings?.headerSubtitle,
      headerColor: settings?.headerColor,
      footerText: settings?.footerText,
      footerColor: settings?.footerColor,
      watermarkText: settings?.watermarkText,
      watermarkOpacity: settings?.watermarkOpacity,
    });
    
    return new Response(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="E3-Request-${requestData.requestNumber || requestData.id}.pdf"`,
        'X-PDF-Engine': 'Unified-E3-v3-Premium',
        'X-Consistency-Locked': 'true'
      }
    });

  } catch (error: any) {
    console.error("[Unified PDF Route] Failure:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
