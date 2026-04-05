import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { claudeAIService } from "@/lib/services/ClaudeAIService";

const ENABLE_AI_ANALYSIS = process.env.ENABLE_AI_ANALYSIS === "true";

/**
 * POST /api/ai/recommend-vendors
 * Recommends vendors based on purchase request details.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    if (!ENABLE_AI_ANALYSIS) {
      return NextResponse.json({ 
        recommendedVendors: [],
        reasonings: { "AI Feature Flag": "OFF" }
      });
    }

    const { requestDetails, vendorOptions } = await req.json();
    if (!requestDetails || !vendorOptions) return NextResponse.json({ error: "Missing required data" }, { status: 400 });

    const recommendations = await claudeAIService.recommendVendors(requestDetails, vendorOptions);
    return NextResponse.json(recommendations);
  } catch (error) {
    console.error("[AI API] Recommend Vendors Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
