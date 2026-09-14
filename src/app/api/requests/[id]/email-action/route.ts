import { NextRequest, NextResponse } from "next/server";
import { emailActionService } from "@/lib/services/EmailActionService";

/**
 * GET /api/requests/[id]/email-action?token=...
 * Safe, read-only token validation and request summary lookup for email action landing page.
 * Completely immune to automated security link pre-fetchers.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paramId } = await params;
    const requestId = parseInt(paramId, 10);
    if (isNaN(requestId)) {
      return NextResponse.json({ error: "Invalid request ID" }, { status: 400 });
    }

    const searchParams = req.nextUrl.searchParams;
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { valid: false, error: "Action token is missing from the link." },
        { status: 400 }
      );
    }

    const context = await emailActionService.getActionContext(token);
    if (!context || context.requestId !== requestId) {
      return NextResponse.json(
        {
          valid: false,
          error: "This action link is invalid, expired, or belongs to another request.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      context,
    });
  } catch (error: any) {
    console.error("[EmailAction API] GET Error:", error);
    return NextResponse.json(
      { valid: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/requests/[id]/email-action
 * Executes 1-click approval, rejection, or revision request with verified action token.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paramId } = await params;
    const requestId = parseInt(paramId, 10);
    if (isNaN(requestId)) {
      return NextResponse.json({ error: "Invalid request ID" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { token, action, comments } = body;

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { success: false, error: "Action token is required." },
        { status: 400 }
      );
    }

    if (!["approved", "rejected", "changes_requested"].includes(action)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid action. Must be 'approved', 'rejected', or 'changes_requested'.",
        },
        { status: 400 }
      );
    }

    const result = await emailActionService.executeAction({
      token,
      action,
      comments,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[EmailAction API] POST Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to execute email action",
      },
      { status: 400 }
    );
  }
}
