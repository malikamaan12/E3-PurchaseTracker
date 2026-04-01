import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { type Express, type Request, type Response, NextFunction } from "express";
import { compare, hash } from 'bcrypt';
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import { users } from "@db/schema";
import { db } from "@db";
import { eq } from "drizzle-orm";
import { AppError } from "./utils/errors";

const JWT_SECRET = process.env.JWT_SECRET || "purchase-management-system-v1-secret-key";
const TOKEN_COOKIE_NAME = "auth_token";

// Extend Express.User interface
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

// Middleware to authenticate token from cookie
export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies[TOKEN_COOKIE_NAME];

  // Add isAuthenticated helper to maintain compatibility with existing routes
  (req as any).isAuthenticated = () => !!req.user;
  (req as any).logout = (cb?: (err: any) => void) => {
    res.clearCookie(TOKEN_COOKIE_NAME);
    if (cb) cb(null);
  };

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as Express.User;
    req.user = decoded;
    next();
  } catch (err) {
    console.error("JWT verification failed:", err);
    res.clearCookie(TOKEN_COOKIE_NAME);
    next();
  }
};

export async function setupAuth(app: Express) {
  console.log('Setting up JWT-based authentication...');

  app.use(cookieParser());
  app.use(passport.initialize());
  app.use(authenticateToken);

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        console.log('Attempting authentication for user:', username);

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.username, username))
          .limit(1);

        if (!user) {
          console.log('User not found:', username);
          return done(null, false, { message: "Invalid username or password" });
        }

        // Check if user account is active
        if (!user.isActive) {
          console.log('Account is inactive:', username);
          return done(null, false, { message: "Account is inactive. Please contact an administrator." });
        }

        const isMatch = await compare(password, user.password);
        if (!isMatch) {
          console.log('Invalid password for user:', username);
          return done(null, false, { message: "Invalid username or password" });
        }

        // Create sanitized user object (without password)
        const sanitizedUser: Express.User = {
          id: user.id,
          username: user.username,
          email: user.email,
          department: user.department,
          role: user.role,
          contactNumber: user.contact_number,
          isActive: user.isActive
        };

        console.log('Authentication successful for user:', username);
        return done(null, sanitizedUser);
      } catch (err) {
        console.error('Authentication error:', err);
        return done(err);
      }
    })
  );

  // Auth routes
  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate('local', { session: false }, (err: Error | null, user: Express.User | false, info: { message: string } | undefined) => {
      if (err) {
        console.error('Login error:', err);
        return next(err);
      }

      if (!user) {
        return res.status(401).json({ message: info?.message || 'Invalid credentials' });
      }

      // Generate JWT
      const token = jwt.sign(user, JWT_SECRET, { expiresIn: '24h' });

      // Set cookie
      res.cookie(TOKEN_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });

      return res.json({ user });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie(TOKEN_COOKIE_NAME);
    res.json({ message: 'Logged out successfully' });
  });

  app.get("/api/auth/user", (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    res.json(req.user);
  });

  // Create test admin user if it doesn't exist
  try {
    const password = await hash('admin123', 10);
    await db
      .insert(users)
      .values({
        username: 'admin',
        password,
        email: 'admin@example.com',
        department: 'IT',
        role: 'admin',
        contact_number: '123-456-7890',
        isActive: true
      })
      .onConflictDoNothing()
      .execute();
    console.log('Test admin user created/verified');
  } catch (error) {
    console.error('Error creating test admin user:', error);
  }
}