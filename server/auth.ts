import passport from "passport";
import { type Express, type Request, type Response, NextFunction } from "express";
import * as bcrypt from 'bcryptjs';
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import { users } from "@db/schema";
import { db } from "@db";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET || "purchase-management-system-v1-secret-key";
const TOKEN_COOKIE_NAME = "auth_token";

/**
 * PurchaseTracker Authentication Layer
 * Standardized on JWT-in-Cookie. 
 * Note: Passport is kept for initialization but login is now a DIRECT handler 
 * to ensure maximum stability in serverless environments.
 */
declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
      email: string;
      department: string;
      role: string;
      contactNumber: string;
      isActive: boolean;
    }
  }
}

/**
 * JWT Verification Middleware
 */
export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies[TOKEN_COOKIE_NAME];
  (req as any).isAuthenticated = () => !!req.user;
  (req as any).logout = (cb?: (err: any) => void) => {
    res.clearCookie(TOKEN_COOKIE_NAME);
    if (cb) cb(null);
  };
  
  if (!token) return next();
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as Express.User;
    req.user = decoded;
    next();
  } catch (err: any) {
    console.error("[Auth] JWT Verification failed:", err?.message || err);
    res.clearCookie(TOKEN_COOKIE_NAME);
    next();
  }
};

/**
 * Set up Authentication routes and middleware
 */
export async function setupAuth(app: Express) {
  console.log('[Auth] Initializing authentication layer...');
  
  app.use(cookieParser());
  app.use(passport.initialize());
  app.use(authenticateToken);

  /**
   * DIRECT LOGIN HANDLER (No Passport.js)
   * This is a robust, transparent handler that bypasses Passport's internal complexities.
   */
  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    
    try {
      console.log(`[Auth][Login] Attempt: ${username}`);
      
      // 1. Database Query
      console.time(`[Auth][Login] DB Query: ${username}`);
      const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
      console.timeEnd(`[Auth][Login] DB Query: ${username}`);
      
      if (!user) {
        console.warn(`[Auth][Login] User not found: ${username}`);
        return res.status(401).json({ message: "Invalid username or password" });
      }

      if (!user.isActive) {
        console.warn(`[Auth][Login] Account inactive: ${username}`);
        return res.status(401).json({ message: "Account is inactive. Contact administrator." });
      }

      // 2. Password Verification
      console.time(`[Auth][Login] Password Check: ${username}`);
      const isMatch = await bcrypt.compare(password, user.password);
      console.timeEnd(`[Auth][Login] Password Check: ${username}`);
      
      if (!isMatch) {
        console.warn(`[Auth][Login] Password mismatch: ${username}`);
        return res.status(401).json({ message: "Invalid username or password" });
      }

      // 3. User Payload Creation
      const sanitizedUser: Express.User = {
        id: user.id,
        username: user.username,
        email: user.email,
        department: user.department,
        role: user.role,
        contactNumber: user.contact_number,
        isActive: user.isActive
      };

      // 4. Token Generation & Cookie Placement
      const token = jwt.sign(sanitizedUser, JWT_SECRET, { expiresIn: '24h' });
      res.cookie(TOKEN_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
      });

      console.log(`[Auth][Login] SUCCESS: ${username}`);
      return res.json({ user: sanitizedUser });
      
    } catch (err: any) {
      console.error(`[Auth][Login] FATAL ERROR: ${username}`, err);
      return res.status(500).json({ error: "Internal Server Error", message: err?.message || err });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie(TOKEN_COOKIE_NAME);
    res.json({ message: 'Logged out successfully' });
  });

  app.get("/api/auth/user", (req, res) => {
    if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
    res.json(req.user);
  });

  /**
   * Background Task: Ensure Default Admin exists
   */
  (async () => {
    try {
      console.log('[AuthSeed] Verifying system admin existence...');
      const startTime = Date.now();
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      await db.insert(users).values({
        username: 'admin',
        password: hashedPassword,
        email: 'admin@example.com',
        department: 'IT',
        role: 'admin',
        contact_number: '123-456-7890',
        isActive: true
      }).onConflictDoNothing().execute();
      
      console.log(`[AuthSeed] System admin verification finished in ${Date.now() - startTime}ms`);
    } catch (e: any) {
      console.error('[AuthSeed] ERROR during seeding:', e?.message || e);
    }
  })();
}