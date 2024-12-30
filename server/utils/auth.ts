import { db } from "@db";
import { users } from "@db/schema";
import { eq } from "drizzle-orm";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { type Express } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import { compare, hash } from 'bcrypt';
import { AppError } from "./errors";

declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
      email: string;
      department: string;
      role: string;
      contact_number: string;
      isActive: boolean;
      createdAt?: Date | null;
      updatedAt?: Date | null;
    }
  }
}

export const mandatoryDepartments = ["Finance", "CEO Office", "Director"];

export async function setupAuth(app: Express) {
  console.log('Setting up authentication...');

  // Configure session
  const MemoryStore = createMemoryStore(session);
  const sessionSettings: session.SessionOptions = {
    secret: process.env.REPL_ID || "vendor-management-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    },
    store: new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    }),
  };

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Configure passport local strategy
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        console.log('LocalStrategy: Authentication attempt:', { username });

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

        // Create user object without sensitive data
        const safeUser: Express.User = {
          id: user.id,
          username: user.username,
          email: user.email,
          department: user.department,
          role: user.role,
          contact_number: user.contact_number,
          isActive: user.isActive,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        };

        console.log('Authentication successful for user:', username);
        return done(null, safeUser);
      } catch (err) {
        console.error('Authentication error:', err);
        return done(err);
      }
    })
  );

  // Configure session serialization
  passport.serializeUser((user, done) => {
    console.log('Serializing user:', user.id);
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      console.log('Deserializing user:', id);

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      if (!user) {
        console.log('Deserialization failed: User not found:', id);
        return done(null, false);
      }

      // Create safe user object
      const safeUser: Express.User = {
        id: user.id,
        username: user.username,
        email: user.email,
        department: user.department,
        role: user.role,
        contact_number: user.contact_number,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      };

      console.log('User deserialized successfully:', {
        id: user.id,
        username: user.username
      });

      done(null, safeUser);
    } catch (error) {
      console.error('Deserialization error:', error);
      done(error);
    }
  });

  // Setup auth routes
  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate('local', (err: Error | null, user: Express.User | false, info: { message: string } | undefined) => {
      if (err) {
        console.error('Login error:', err);
        return next(err);
      }

      if (!user) {
        return res.status(401).json({ message: info?.message || 'Invalid credentials' });
      }

      req.logIn(user, (err) => {
        if (err) {
          console.error('Login error:', err);
          return next(err);
        }

        return res.json({ user });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        console.error('Logout error:', err);
        return res.status(500).json({ message: 'Logout failed' });
      }
      res.json({ message: 'Logged out successfully' });
    });
  });

  app.get("/api/auth/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    res.json(req.user);
  });

  // Create test admin user if it doesn't exist
  try {
    const hashedPassword = await hash('admin123', 10);
    await db
      .insert(users)
      .values({
        username: 'admin',
        password: hashedPassword,
        email: 'admin@example.com',
        department: 'IT',
        role: 'admin',
        contact_number: '123-456-7890',
        isActive: true
      })
      .onConflictDoNothing();

    console.log('Test admin user created/verified');
  } catch (error) {
    console.error('Error creating test admin user:', error);
  }

  console.log('Authentication setup completed');
}

export async function configurePassport(passport: passport.Authenticator) {
  // Configure LocalStrategy
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        console.log('LocalStrategy: Authentication attempt:', { username });

        // Find user in database with detailed logging
        const userResult = await db
          .select()
          .from(users)
          .where(eq(users.username, username))
          .limit(1);

        console.log('LocalStrategy: Database query result:', {
          found: userResult.length > 0,
          username
        });

        const [user] = userResult;

        if (!user) {
          console.log('LocalStrategy: User not found:', username);
          return done(null, false, { message: 'Invalid username or password' });
        }

        console.log('LocalStrategy: User found, verifying password');

        // Verify password with detailed logging
        let isValidPassword = false;
        try {
          isValidPassword = await compare(password, user.password);
          console.log('LocalStrategy: Password verification result:', { 
            username,
            isValid: isValidPassword 
          });
        } catch (error) {
          console.error('LocalStrategy: Password comparison error:', error);
          return done(error);
        }

        if (!isValidPassword) {
          console.log('LocalStrategy: Invalid password for user:', username);
          return done(null, false, { message: 'Invalid username or password' });
        }

        console.log('LocalStrategy: Authentication successful for user:', {
          id: user.id,
          username: user.username,
          department: user.department,
          role: user.role
        });

        // Create sanitized user object (without password)
        const sanitizedUser: Express.User = {
          id: user.id,
          username: user.username,
          department: user.department,
          role: user.role,
          email: user.email,
          contact_number: user.contact_number,
          isActive: user.isActive,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        };

        return done(null, sanitizedUser);
      } catch (error) {
        console.error('LocalStrategy: Unexpected error during authentication:', error);
        return done(error);
      }
    })
  );

  // User serialization for session
  passport.serializeUser((user: Express.User, done) => {
    console.log('Serializing user:', {
      id: user.id,
      username: user.username
    });
    done(null, user.id);
  });

  // User deserialization from session
  passport.deserializeUser(async (id: number, done) => {
    try {
      console.log('Deserializing user:', id);

      const [user] = await db
        .select({
          id: users.id,
          username: users.username,
          department: users.department,
          role: users.role,
          email: users.email,
          contact_number: users.contact_number,
          isActive: users.isActive,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt
        })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      if (!user) {
        console.log('Deserialization failed: User not found:', id);
        return done(null, false);
      }

      console.log('User deserialized successfully:', {
        id: user.id,
        username: user.username
      });

      done(null, user);
    } catch (error) {
      console.error('Deserialization error:', error);
      done(error);
    }
  });
}

// Create or update test user with proper password hashing
export async function createTestUser() {
  try {
    console.log('Creating/updating test user');
    const hashedPassword = await hash('admin123', 10);

    const [user] = await db
      .insert(users)
      .values({
        username: 'testadmin',
        password: hashedPassword,
        department: 'CEO Office',
        role: 'admin',
        email: 'testadmin@example.com',
        contact_number: '123456789',
        isActive: true
      })
      .onConflictDoUpdate({
        target: users.username,
        set: {
          password: hashedPassword,
          contact_number: '123456789'
        }
      })
      .returning();

    console.log('Test user created/updated successfully:', {
      id: user.id,
      username: user.username
    });
    return user;
  } catch (error) {
    console.error('Failed to create test user:', error);
    throw error;
  }
}

export async function hashPassword(password: string): Promise<string> {
  try {
    return await hash(password, 10);
  } catch (error) {
    console.error('Password hashing error:', error);
    throw error;
  }
}

export async function canUserApprove(userId: number, requestId: number): Promise<boolean> {
  try {
    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      console.log('User not found for approval check:', userId);
      return false;
    }

    if (user.role === 'admin' || mandatoryDepartments.includes(user.department)) {
      return true;
    }

    return false;
  } catch (error) {
    console.error("Error checking user approval rights:", error);
    return false;
  }
}