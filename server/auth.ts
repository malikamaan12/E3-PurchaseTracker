import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { type Express } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import { compare, hash } from "bcrypt";
import { users, type SelectUser } from "@db/schema";
import { db } from "@db";
import { eq } from "drizzle-orm";

// extend express user object with our schema
declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

export async function setupAuth(app: Express) {
  // Configure session
  const MemoryStore = createMemoryStore(session);
  const sessionSettings: session.SessionOptions = {
    secret: process.env.REPL_ID || "purchase-management-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true,
    },
    store: new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    }),
  };

  if (app.get("env") === "production") {
    app.set("trust proxy", 1);
    sessionSettings.cookie = {
      ...sessionSettings.cookie,
      secure: true,
    };
  }

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Configure LocalStrategy with improved error handling
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

        console.log('Authentication successful for user:', username);
        return done(null, user);
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
      const [user] = await db
        .select()
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

  // Authentication routes
  app.post("/api/login", (req, res, next) => {
    try {
      console.log('Login request received:', { username: req.body.username });

      if (!req.body.username || !req.body.password) {
        console.log('Login failed: Missing credentials');
        return res.status(400).json({ message: 'Username and password are required' });
      }

      passport.authenticate('local', (err: any, user: any, info: any) => {
        if (err) {
          console.error('Authentication error:', err);
          return next(err);
        }

        if (!user) {
          console.log('Login failed:', info?.message);
          return res.status(401).json({ message: info?.message || 'Invalid username or password' });
        }

        req.logIn(user, (loginErr) => {
          if (loginErr) {
            console.error('Login session error:', loginErr);
            return next(loginErr);
          }

          console.log('Login successful:', { userId: user.id, username: user.username });
          return res.json({ 
            user: {
              id: user.id,
              username: user.username,
              email: user.email,
              department: user.department,
              role: user.role,
              contactNumber: user.contactNumber
            }
          });
        });
      })(req, res, next);
    } catch (error) {
      console.error('Unexpected login error:', error);
      next(error);
    }
  });

  app.get("/api/user", (req, res) => {
    if (req.isAuthenticated()) {
      const user = req.user;
      return res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        department: user.department,
        role: user.role,
        contactNumber: user.contactNumber
      });
    }
    res.status(401).json({
      error: "Not authenticated",
      message: "Please log in to access this resource"
    });
  });
}

// Create or update test user
export async function createTestUser() {
  try {
    console.log('Creating/updating test user');
    const testUserData = {
      username: 'admin',
      password: await hash('admin123', 10),
      email: 'admin@example.com',
      department: 'IT',
      role: 'admin',
      contactNumber: '123-456-7890'
    };

    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.username, testUserData.username))
      .limit(1);

    if (existingUser) {
      // Update existing user
      const [updatedUser] = await db
        .update(users)
        .set({
          password: testUserData.password,
          email: testUserData.email,
          department: testUserData.department,
          role: testUserData.role,
          contactNumber: testUserData.contactNumber
        })
        .where(eq(users.id, existingUser.id))
        .returning();

      console.log('Test user updated:', {
        id: updatedUser.id,
        username: updatedUser.username
      });
      return updatedUser;
    } else {
      // Create new user
      const [newUser] = await db
        .insert(users)
        .values(testUserData)
        .returning();

      console.log('Test user created:', {
        id: newUser.id,
        username: newUser.username
      });
      return newUser;
    }
  } catch (error) {
    console.error('Failed to create/update test user:', error);
    throw error;
  }
}