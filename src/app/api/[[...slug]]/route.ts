import { NextRequest, NextResponse } from "next/server";
import { handleApiRequest } from "@/lib/api-handler";

/**
 * Universal API Bridge
 * Catch-all route to serve all Express backend logic within Next.js Serverless.
 */

export async function GET(req: NextRequest) {
  return handleApiRequest(req);
}

export async function POST(req: NextRequest) {
  return handleApiRequest(req);
}

export async function PUT(req: NextRequest) {
  return handleApiRequest(req);
}

export async function PATCH(req: NextRequest) {
  return handleApiRequest(req);
}

export async function DELETE(req: NextRequest) {
  return handleApiRequest(req);
}

/**
 * Ensures OPTIONS is handled for CORS if needed, 
 * though Next.js handled it by default in many cases.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
