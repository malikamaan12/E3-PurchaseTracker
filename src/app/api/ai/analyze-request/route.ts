import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-next";
import { claudeAIService } from "@/lib/services/ClaudeAIService";

const ENABLE_AI_ANALYSIS = process.env.ENABLE_AI_ANALYSIS === "true";

/**
 * POST /api/ai/analyze-request
 * Analyzes purchase request details and provides optimization suggestions.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

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
