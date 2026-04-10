import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { fileAttachments } from "@db/schema";
import { eq } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: paramId } = await params;
    const user = await getAuthenticatedUser(req);
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const attachmentId = parseInt(paramId);
    if (isNaN(attachmentId)) {
      return NextResponse.json({ error: "Invalid attachment ID" }, { status: 400 });
    }

    const [attachment] = await db
      .select()
      .from(fileAttachments)
      .where(eq(fileAttachments.id, attachmentId))
      .limit(1);

    if (!attachment) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    // Redirect the browser/iframe to the presigned R2 URL
    return NextResponse.redirect(attachment.fileUrl);

  } catch (error: any) {
    console.error("[Attachment API] Fetch Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
