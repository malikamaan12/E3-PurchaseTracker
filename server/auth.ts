import { type Express, type Request, type Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import { JWT_SECRET, TOKEN_COOKIE_NAME } from "./utils/config";

/**
 * PurchaseTracker Authentication Middleware (Express-compatible)
 * Lightweight JWT verification — no Passport overhead.
 */
export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies?.[TOKEN_COOKIE_NAME];
  
  (req as any).isAuthenticated = () => !!req.user;
  (req as any).logout = (cb?: (err: any) => void) => {
    res.clearCookie(TOKEN_COOKIE_NAME);
    if (cb) cb(null);
  };
  
  if (!token) return next();
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
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
  app.use(cookieParser());
  // Passport removed — JWT is handled directly by authenticateToken
  app.use(authenticateToken);
}