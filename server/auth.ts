import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { type Express } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import { compare, hash } from 'bcrypt';
import { users } from "@db/schema";
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
      isActive: boolean;
    }
  }
}

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
          isActive: user.isActive
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
        isActive: user.isActive
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