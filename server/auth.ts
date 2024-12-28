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

  console.log('Configuring LocalStrategy...');

  // Configure LocalStrategy with improved error handling and proper field names
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

        // Create sanitized user object (without password) with correct field names
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

  passport.serializeUser((user: Express.User, done) => {
    console.log('Serializing user:', user.id);
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      console.log('Deserializing user:', id);

      // Use explicit field selection to match Express.User interface
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

  // Create test user after setting up auth
  try {
    console.log('Creating test user...');
    await createTestUser();
    console.log('Test user created successfully');
  } catch (error) {
    console.error('Error creating test user:', error);
  }
}

// Create or update test user with proper error handling and field names
export async function createTestUser() {
  try {
    console.log('Attempting to create/update test user');
    const hashedPassword = await hash('admin123', 10);

    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.username, 'admin'))
      .limit(1);

    if (existingUser) {
      console.log('Updating existing admin user');
      const [updatedUser] = await db
        .update(users)
        .set({
          password: hashedPassword,
          email: 'admin@example.com',
          department: 'IT',
          role: 'admin',
          contact_number: '123-456-7890'
        })
        .where(eq(users.id, existingUser.id))
        .returning();

      console.log('Admin user updated successfully:', {
        id: updatedUser.id,
        username: updatedUser.username,
        role: updatedUser.role
      });

      return updatedUser;
    }

    console.log('Creating new admin user');
    const [newUser] = await db
      .insert(users)
      .values({
        username: 'admin',
        password: hashedPassword,
        email: 'admin@example.com',
        department: 'IT',
        role: 'admin',
        contact_number: '123-456-7890'
      })
      .returning();

    console.log('New admin user created successfully:', {
      id: newUser.id,
      username: newUser.username,
      role: newUser.role
    });

    return newUser;
  } catch (error) {
    console.error('Failed to create/update test user:', error);
    throw error;
  }
}