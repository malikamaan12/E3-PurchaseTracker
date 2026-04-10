export const maxDuration = 60;
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { conversionService } from "@/lib/services/ConversionService";
import path from "path";
import fs from "fs/promises";

/**
 * GET /api/conversion/formats
 * List available output formats for a source MIME type.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    
    if (!type) {
      return NextResponse.json({ error: "Source type is required" }, { status: 400 });
    }

    const formats = await conversionService.getAvailableFormats(type);
    return NextResponse.json(formats);
  } catch (error) {
    console.error("[Conversion API] GET Formats Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * POST /api/conversion/convert
 * Trigger file conversion.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { sourceFormat, targetFormat, filePath } = await req.json();
    
    if (!sourceFormat || !targetFormat || !filePath) {
      return NextResponse.json({ error: "Missing required data" }, { status: 400 });
    }

    const absolutePath = path.join(process.cwd(), filePath.replace(/^\/uploads\//, "uploads/"));
    await fs.access(absolutePath);

    const result = await conversionService.convertFile(absolutePath, targetFormat, sourceFormat);
    
    return NextResponse.json({
      success: true,
      fileUrl: `/api/files/download?path=${encodeURIComponent(result.outputPath)}`,
      outputType: result.outputType,
      size: (await fs.stat(result.outputPath)).size,
    });
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return NextResponse.json({ error: "Source file not found" }, { status: 404 });
    }
    console.error("[Conversion API] POST Convert Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

