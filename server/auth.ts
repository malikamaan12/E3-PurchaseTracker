import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { type Express } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import { compare, hash } from "bcrypt";
import { users, accountRequests } from "@db/schema";
import { db } from "@db";
import { eq } from "drizzle-orm";
import { AppError } from "./utils/errors";

// Extend Express.User interface
declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
      email: string;
      department: string;
      role: string;
      contact_number: string;
    }
  }
}

export async function setupAuth(app: Express) {
  console.log('Setting up authentication...');

  // Configure session
  const MemoryStore = createMemoryStore(session);
  const sessionSettings: session.SessionOptions = {
    secret: process.env.REPL_ID || "purchase-management-secret",
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
          contact_number: user.contact_number
        };

        console.log('Authentication successful for user:', username);
        return done(null, sanitizedUser);
      } catch (err) {
        console.error('Authentication error:', err);
        return done(err);
      }
    })
  );

  passport.serializeUser((user, done) => {
    console.log('Serializing user:', user.id);
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      console.log('Deserializing user:', id);

      // Use explicit field selection
      const [user] = await db
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
          department: users.department,
          role: users.role,
          contact_number: users.contact_number
        })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      if (!user) {
        console.log('User not found during deserialization:', id);
        return done(null, false);
      }

      done(null, user);
    } catch (err) {
      console.error('Deserialization error:', err);
      done(err);
    }
  });

  // Auth routes
  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
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

  app.post("/api/auth/request-account", async (req, res, next) => {
    try {
      const { username, password, email, contact_number, department, role } = req.body;

      // Check for existing user
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Check for existing request
      const [existingRequest] = await db
        .select()
        .from(accountRequests)
        .where(eq(accountRequests.username, username))
        .limit(1);

      if (existingRequest) {
        return res.status(400).json({ message: "Account request already exists" });
      }

      const hashedPassword = await hash(password, 10);

      const [newRequest] = await db
        .insert(accountRequests)
        .values({
          username,
          password: hashedPassword,
          email,
          contact_number,
          department,
          role: role || 'user',
          status: 'pending'
        })
        .returning();

      res.status(201).json({
        message: "Account request submitted successfully",
        request: {
          id: newRequest.id,
          username: newRequest.username,
          email: newRequest.email,
          status: newRequest.status
        }
      });
    } catch (error) {
      next(error);
    }
  });

  // Create test admin user
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
        contact_number: '123-456-7890'
      })
      .onConflictDoNothing()
      .execute();
    console.log('Test admin user created/verified');
  } catch (error) {
    console.error('Error creating test admin user:', error);
  }
}