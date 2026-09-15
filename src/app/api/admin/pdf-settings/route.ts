import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { pdfSettings, insertPdfSettingsSchema } from "@db/schema";
import { eq, sql } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";

export const dynamic = 'force-dynamic';

const DEFAULT_BRANDING = {
  headerTitle: "E3 MANAGEMENT SOLUTIONS & LOGISTICS",
  headerSubtitle: "Official Commercial Purchase Order • Procurement Document",
  headerColor: "#5B4B8A",
  footerText: "CONFIDENTIAL",
  footerColor: "#2FB7B2",
  watermarkText: "INTERNAL ONLY",
  watermarkOpacity: 10,
  fontSize: 11,
  fontFamily: "helvetica",
  logoPosition: "left",
};

/**
 * GET /api/admin/pdf-settings
 * Fetch global PDF branding configuration.
 * Access: Admin only.
 */
export async function GET(req: NextRequest) {
  try {
    const admin = await getAuthenticatedUser(req);
    if (!admin) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    if (admin.role !== 'super_admin') {
      return NextResponse.json({ error: "Access denied. Super Admin role required." }, { status: 403 });
    }

    const [settings] = await db.select().from(pdfSettings).limit(1);
    
    // If empty, return defaults (but don't seed yet to avoid side-effects on GET)
    return NextResponse.json(settings || DEFAULT_BRANDING);
  } catch (error: any) {
    console.error("[Native Admin API] PDF Settings GET Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/pdf-settings
 * Update global PDF branding configuration.
 * Access: Admin only.
 */
export async function PATCH(req: NextRequest) {
  try {
    const admin = await getAuthenticatedUser(req);
    if (!admin) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    if (admin.role !== 'super_admin') {
      return NextResponse.json({ error: "Access denied. Super Admin role required." }, { status: 403 });
    }

    const body = await req.json();
    
    // Strip system-controlled fields to prevent serialization date/type mismatches
    delete body.id;
    delete body.userId;
    delete body.createdAt;
    delete body.updatedAt;

    const validationResult = insertPdfSettingsSchema.partial().safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({
        message: "Validation failed",
        errors: validationResult.error.format(),
      }, { status: 400 });
    }

    const [existing] = await db.select().from(pdfSettings).limit(1);

    let updated;
    if (existing) {
      const { id: _id, updatedAt: _ua, userId: _ui, createdAt: _ca, ...updateData } = validationResult.data as any;

      [updated] = await db
        .update(pdfSettings)
        .set({ 
          ...updateData, 
          updatedAt: new Date(),
          userId: admin.id 
        })
        .where(eq(pdfSettings.id, existing.id))
        .returning();
    } else {
      [updated] = await db
        .insert(pdfSettings)
        .values({
          ...DEFAULT_BRANDING,
          ...validationResult.data,
          userId: admin.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any)
        .returning();
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("[Native Admin API] PDF Settings PATCH Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
