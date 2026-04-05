import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { subPurposes } from "@db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";

export const dynamic = 'force-dynamic';

// GET /api/requests/sub-purposes
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const purposeType = searchParams.get("purposeType");
    
    const conditions = [eq(subPurposes.is_frozen, false)];
    if (purposeType) {
      conditions.push(eq(subPurposes.purpose_type, purposeType));
    }

    const activeSubPurposes = await db
      .select({
        id: subPurposes.id,
        name: subPurposes.name,
        purpose_type: subPurposes.purpose_type
      })
      .from(subPurposes)
      .where(and(...conditions))
      .orderBy(desc(subPurposes.created_at));

    return NextResponse.json(activeSubPurposes);
  } catch (error: any) {
    console.error("[Native API] Sub-purposes Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
