import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { vendorDocuments, vendors } from "@db/schema";
import { eq } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const vendorId = parseInt(params.id);
    if (isNaN(vendorId)) return NextResponse.json({ error: "Invalid vendor ID" }, { status: 400 });

    const documents = await db
      .select()
      .from(vendorDocuments)
      .where(eq(vendorDocuments.vendorId, vendorId));

    return NextResponse.json(documents);
  } catch (error: any) {
    console.error("[Vendor Documents GET Error]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const vendorId = parseInt(params.id);
    if (isNaN(vendorId)) return NextResponse.json({ error: "Invalid vendor ID" }, { status: 400 });

    const body = await req.json();
    const { documentType, documentName, fileUrl, expiryDate } = body;

    if (!documentType || !documentName || !fileUrl) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify vendor exists
    const [vendor] = await db.select().from(vendors).where(eq(vendors.id, vendorId)).limit(1);
    if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

    const [newDoc] = await db.insert(vendorDocuments).values({
      vendorId,
      documentType,
      documentName,
      fileUrl,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      status: "valid"
    }).returning();

    return NextResponse.json(newDoc, { status: 201 });
  } catch (error: any) {
    console.error("[Vendor Documents POST Error]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
