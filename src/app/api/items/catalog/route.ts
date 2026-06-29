import { NextResponse } from "next/server";
import { db } from "@db";
import { itemCatalog } from "@db/schema";
import { desc } from "drizzle-orm";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const items = await db
      .select()
      .from(itemCatalog)
      .orderBy(desc(itemCatalog.createdAt));

    return NextResponse.json(items);
  } catch (error) {
    console.error("[API] GET /items/catalog Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch item catalog" },
      { status: 500 }
    );
  }
}
