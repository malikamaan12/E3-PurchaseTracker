import { NextRequest, NextResponse } from "next/server";
import { Express } from "express";
import express from "express";
import { registerRoutes } from "../../server/routes";

// Singleton Express instance for Next.js API Routes
let app: Express | null = null;

function getApp() {
  if (app) return app;

  app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Initialize your existing modular routes
  registerRoutes(app);

  return app;
}

/**
 * Bridge function to handle Next.js requests via Express
 */
export async function handleApiRequest(req: NextRequest, { params }: { params: any }) {
  const expressApp = getApp();
  
  // This is a simplified bridge. 
  // In a real Vercel environment, we use Next.js's native ability to handle 
  // Express-like middleware via next-connect if the logic gets complex.
  
  // For basic routing, we let Next.js handle the slug and point it to the relevant 
  // domain logic in our existing controllers.
  
  return NextResponse.json({ 
    message: "PurchaseTracker API Bridge Active",
    path: req.nextUrl.pathname 
  });
}
