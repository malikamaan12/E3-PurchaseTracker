import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { claudeAIService } from "@/lib/services/ClaudeAIService";
import { durableRateLimiter } from "@/lib/services/DurableRateLimitService";

const ENABLE_AI_ANALYSIS = process.env.ENABLE_AI_ANALYSIS === "true";

/**
 * POST /api/ai/analyze-request
 * Analyzes purchase request details and provides optimization suggestions.
 * Rate limited to 5 calls per minute per user.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    // Rate limit: 5 requests per minute per user to protect token budget
    const rateCheck = await durableRateLimiter.consume(`ai_analyze:${user.id}`, 5, 60);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Too many AI analysis requests. Please wait a moment." },
        { status: 429 }
      );
    }

    if (!ENABLE_AI_ANALYSIS) {
      return NextResponse.json({ 
        optimizationSuggestions: ["AI Analysis is currently disabled"],
        costSavings: "N/A",
        priorityScore: 50,
        priorityReason: "AI feature flag is OFF"
      });
    }

    const { requestDetails } = await req.json();
    if (!requestDetails) return NextResponse.json({ error: "Missing request details" }, { status: 400 });

    const analysis = await claudeAIService.analyzeRequest(requestDetails);
    return NextResponse.json(analysis);
  } catch (error) {
    console.error("[AI API] Analyze Request Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
