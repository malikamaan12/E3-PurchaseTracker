import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { systemSettings } from "@db/schema";
import { eq } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/system-settings
 * Fetch all system-wide key-value settings.
 * Access: Admin only.
 */
export async function GET(req: NextRequest) {
  try {
    const admin = await getAuthenticatedUser(req);
    if (!admin) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    if (admin.role !== 'admin') {
      return NextResponse.json({ error: "Access denied. Admin only route." }, { status: 403 });
    }

    const records = await db.select().from(systemSettings);
    
    // Convert to object { [key]: value } as expected by the frontend
    const settings = records.reduce((acc, curr) => ({
      ...acc,
      [curr.key]: curr.value
    }), {});

    return NextResponse.json(settings);
  } catch (error: any) {
    console.error("[Native Admin API] System Settings GET Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/system-settings
 * Batch update system-wide settings.
 * Access: Admin only.
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await getAuthenticatedUser(req);
    if (!admin) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    if (admin.role !== 'admin') {
      return NextResponse.json({ error: "Access denied. Admin only route." }, { status: 403 });
    }

    const body = await req.json();
    const entries = Object.entries(body as Record<string, any>);

    for (const [key, value] of entries) {
      const stringValue = String(value);
      
      // Upsert logic for each key
      await db.insert(systemSettings)
        .values({ 
          key, 
          value: stringValue, 
          updatedBy: admin.id,
          updatedAt: new Date()
        })
        .onConflictDoUpdate({
          target: systemSettings.key,
          set: { 
            value: stringValue, 
            updatedAt: new Date(),
            updatedBy: admin.id
          }
        });
    }

    return NextResponse.json({ message: "Settings updated successfully" });
  } catch (error: any) {
    console.error("[Native Admin API] System Settings POST Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
