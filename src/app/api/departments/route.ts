import { NextResponse } from "next/server";
import { db } from "@db";
import { departments } from "@db/schema";
import { desc } from "drizzle-orm";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await db.select().from(departments).orderBy(desc(departments.createdAt));
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[Native API] Departments Error:", error);
    return NextResponse.json({ error: "Failed to fetch departments" }, { status: 500 });
  }
}
