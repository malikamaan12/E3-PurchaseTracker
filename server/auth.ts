import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { type Express } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import { compare, hash } from "bcrypt";
import { users, insertUserSchema } from "@db/schema";
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
      contactNumber: string;
    }
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

        // Create sanitized user object (without password)
        const sanitizedUser: Express.User = {
          id: user.id,
          username: user.username,
          email: user.email,
          department: user.department,
          role: user.role,
          contactNumber: user.contactNumber
        };

        console.log('Authentication successful for user:', username);
        return done(null, sanitizedUser);
      } catch (err) {
        console.error('Authentication error:', err);
        return done(err);
      }
    })
  );

  passport.serializeUser((user: Express.User, done) => {
    console.log('Serializing user:', user.id);
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      console.log('Deserializing user:', id);
      const [user] = await db
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
          department: users.department,
          role: users.role,
          contactNumber: users.contactNumber
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

  // Registration endpoint
  app.post("/api/auth/register", async (req, res, next) => {
    try {
      console.log('Registration request received:', { username: req.body.username });
      const result = insertUserSchema.safeParse(req.body);

      if (!result.success) {
        console.log('Registration validation failed:', result.error.issues);
        return res.status(400).json({ 
          message: 'Invalid input', 
          errors: result.error.issues 
        });
      }

      const { username, password, email, department, role, contactNumber } = result.data;

      // Check if user already exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (existingUser) {
        console.log('Username already exists:', username);
        return res.status(400).json({ message: "Username already exists" });
      }

      // Hash the password
      const hashedPassword = await hash(password, 10);

      // Create the new user
      const [newUser] = await db
        .insert(users)
        .values({
          username,
          password: hashedPassword,
          email,
          department,
          role: role || 'user',
          contactNumber,
        })
        .returning();

      // Create sanitized user object (without password)
      const sanitizedUser: Express.User = {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        department: newUser.department,
        role: newUser.role,
        contactNumber: newUser.contactNumber
      };

      // Log the user in after registration
      req.login(sanitizedUser, (err) => {
        if (err) {
          console.error('Auto-login after registration failed:', err);
          return next(err);
        }
        console.log('Registration and auto-login successful:', { userId: newUser.id });
        return res.status(201).json({
          message: "Registration successful",
          user: sanitizedUser
        });
      });
    } catch (error) {
      console.error('Registration error:', error);
      next(new AppError('Registration failed', 500));
    }
  });

  // Test user creation with proper error handling
  try {
    await createTestUser();
  } catch (error) {
    console.error('Failed to create test user:', error);
  }
}

// Create or update test user with proper error handling
export async function createTestUser() {
  try {
    console.log('Creating/updating test user');
    const hashedPassword = await hash('admin123', 10);

    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.username, 'admin'))
      .limit(1);

    if (existingUser) {
      // Update existing user's password
      const [updatedUser] = await db
        .update(users)
        .set({
          password: hashedPassword,
          email: 'admin@example.com',
          department: 'IT',
          role: 'admin',
          contactNumber: '123-456-7890'
        })
        .where(eq(users.id, existingUser.id))
        .returning();

      console.log('Test user updated:', {
        id: updatedUser.id,
        username: updatedUser.username
      });
      return updatedUser;
    }

    // Create new test user
    const [newUser] = await db
      .insert(users)
      .values({
        username: 'admin',
        password: hashedPassword,
        email: 'admin@example.com',
        department: 'IT',
        role: 'admin',
        contactNumber: '123-456-7890'
      })
      .returning();

    console.log('Test user created:', {
      id: newUser.id,
      username: newUser.username
    });
    return newUser;
  } catch (error) {
    console.error('Failed to create/update test user:', error);
    throw error;
  }
}