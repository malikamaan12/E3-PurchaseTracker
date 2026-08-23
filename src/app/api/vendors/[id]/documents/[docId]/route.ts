import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { vendorDocuments } from "@db/schema";
import { eq, and } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { complianceService } from "@/lib/services/ComplianceService";

export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string, docId: string }> }) {
  try {
    const { id: paramId, docId: paramDocId } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const canManage = user.role === "admin" || user.role === "super_admin" || (user as any).canManageVendors === true;
    if (!canManage) return NextResponse.json({ error: "Access Denied: Vendor management permissions required" }, { status: 403 });

    const vendorId = parseInt(paramId);
    const docId = parseInt(paramDocId);
    if (isNaN(vendorId) || isNaN(docId)) return NextResponse.json({ error: "Invalid IDs" }, { status: 400 });

    await db.delete(vendorDocuments).where(and(eq(vendorDocuments.id, docId), eq(vendorDocuments.vendorId, vendorId)));

    // Trigger compliance scan immediately
    await complianceService.scanVendorDocuments(vendorId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Vendor Documents DELETE Error]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string, docId: string }> }) {
  try {
    const { id: paramId, docId: paramDocId } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const canManage = user.role === "admin" || user.role === "super_admin" || (user as any).canManageVendors === true;
    if (!canManage) return NextResponse.json({ error: "Access Denied: Vendor management permissions required" }, { status: 403 });

    const vendorId = parseInt(paramId);
    const docId = parseInt(paramDocId);
    if (isNaN(vendorId) || isNaN(docId)) return NextResponse.json({ error: "Invalid IDs" }, { status: 400 });

    const body = await req.json();
    const updateData: any = {};
    if (body.status !== undefined) updateData.status = body.status;
    if (body.expiryDate !== undefined) updateData.expiryDate = body.expiryDate ? new Date(body.expiryDate) : null;
    if (body.documentName !== undefined) updateData.documentName = body.documentName;

    const [updatedDoc] = await db.update(vendorDocuments)
      .set(updateData)
      .where(and(eq(vendorDocuments.id, docId), eq(vendorDocuments.vendorId, vendorId)))
      .returning();

    // Trigger compliance scan immediately
    await complianceService.scanVendorDocuments(vendorId);

    return NextResponse.json(updatedDoc);
  } catch (error: any) {
    console.error("[Vendor Documents PATCH Error]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
