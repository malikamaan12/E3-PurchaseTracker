import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { claudeAIService } from "@/lib/services/ClaudeAIService";
import { durableRateLimiter } from "@/lib/services/DurableRateLimitService";

const ENABLE_AI_ANALYSIS = process.env.ENABLE_AI_ANALYSIS === "true";

/**
 * POST /api/ai/recommend-vendors
 * Recommends vendors based on purchase request details.
 * Rate limited to 10 calls per minute per user.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    // Rate limit: 10 requests per minute per user
    const rateCheck = await durableRateLimiter.consume(`ai_recommend:${user.id}`, 10, 60);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Too many vendor recommendation requests. Please wait a moment." },
        { status: 429 }
      );
    }

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
