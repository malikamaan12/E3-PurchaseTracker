import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { itemCatalog } from "@db/schema";
import { desc } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Authentication is required to access the item catalog." },
        { status: 401 }
      );
    }

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

