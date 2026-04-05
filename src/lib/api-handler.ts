import { NextResponse } from "next/server";

/**
 * DEPRECATED: Standardized API Bridge
 * This bridge was used during the Phase 1-3 modernization.
 * It is now officially decommissioned as all routes are native.
 */
export async function handleApiRequest() {
  return NextResponse.json({ 
    error: "Service Decommissioned", 
    message: "This legacy Express bridge has been removed in favor of native Next.js API routes." 
  }, { status: 410 }); // 410 Gone
}
