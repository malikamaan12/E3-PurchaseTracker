import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { type Express, type Request, type Response, NextFunction } from "express";
import * as bcrypt from 'bcryptjs';
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import { users } from "@db/schema";
import { db } from "@db";
import { eq } from "drizzle-orm";
import { AppError } from "./utils/errors";

const JWT_SECRET = process.env.JWT_SECRET || "purchase-management-system-v1-secret-key";
const TOKEN_COOKIE_NAME = "auth_token";

/**
 * Passport Implementation for PurchaseTracker
 * Standardized on JWT-in-Cookie for serverless compliance.
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
  } catch (err) {
    res.clearCookie(TOKEN_COOKIE_NAME);
    next();
  }
};

export async function setupAuth(app: Express) {
  console.log('[Auth] Initializing authentication layer...');
  app.use(cookieParser());
  app.use(passport.initialize());
  app.use(authenticateToken);

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        console.log(`[Auth] Login attempt: ${username}`);
        const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
        
        if (!user || !user.isActive) {
          return done(null, false, { message: "Invalid credentials or inactive account" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return done(null, false, { message: "Invalid credentials" });

        const sanitizedUser: Express.User = {
          id: user.id,
          username: user.username,
          email: user.email,
          department: user.department,
          role: user.role,
          contactNumber: user.contact_number,
          isActive: user.isActive
        };
        return done(null, sanitizedUser);
      } catch (err) {
        return done(err);
      }
    })
  );

  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate('local', { session: false }, (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: info?.message || 'Unauthorized' });
      
      const token = jwt.sign(user, JWT_SECRET, { expiresIn: '24h' });
      res.cookie(TOKEN_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
      });
      return res.json({ user });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie(TOKEN_COOKIE_NAME);
    res.json({ message: 'Logged out' });
  });

  app.get("/api/auth/user", (req, res) => {
    if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
    res.json(req.user);
  });

  // Fault-tolerant default user seeding
  (async () => {
    try {
      console.log('[AuthSeed] Verifying system admin...');
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
      console.log(`[AuthSeed] System admin verified (${Date.now() - startTime}ms)`);
    } catch (e) {
      console.error('[AuthSeed] ERROR during seeding:', e);
    }
  })();
}