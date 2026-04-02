import passport from "passport";
import { type Express, type Request, type Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import { JWT_SECRET, TOKEN_COOKIE_NAME } from "./utils/config";

/**
 * PurchaseTracker Authentication Middleware (Express-compatible)
 * This is still used by the Express bridge for domain-specific routes 
 * (like /api/vendors, /api/requests) that require authentication.
 */
export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies[TOKEN_COOKIE_NAME];
  console.log(`[AuthBridge] Verifying token for: ${req.method} ${req.url} - Token present: ${!!token}`);
  
  (req as any).isAuthenticated = () => !!req.user;
  (req as any).logout = (cb?: (err: any) => void) => {
    res.clearCookie(TOKEN_COOKIE_NAME);
    if (cb) cb(null);
  };
  
  if (!token) return next();
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    console.log(`[AuthBridge] SUCCESS: User identified as ${decoded.username}`);
    next();
  } catch (err: any) {
    console.error("[AuthBridge] JWT Verification failed:", err.message);
    res.clearCookie(TOKEN_COOKIE_NAME);
    next();
  }
};

/**
 * Setup Authentication (Middleware only)
 */
export async function setupAuth(app: Express) {
  console.log('[Auth] Initializing middleware-only layer...');
  
  app.use(cookieParser());
  app.use(passport.initialize());
  app.use(authenticateToken);

  // Note: All /api/auth/* routes have been migrated to native Next.js API routes
  // to prevent serverless bridge hangs. See /src/app/api/auth/* for implementation.
  // The 'AuthSeed' background hashing has been REMOVED to prevent CPU starvation.
}