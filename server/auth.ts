import passport from "passport";
import { IVerifyOptions, Strategy as LocalStrategy } from "passport-local";
import { type Express } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { users, insertUserSchema, loginSchema } from "@db/schema";
import { db, testConnection } from "@db";
import { eq } from "drizzle-orm";

const scryptAsync = promisify(scrypt);
const crypto = {
  hash: async (password: string) => {
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buf.toString("hex")}.${salt}`;
  },
  compare: async (suppliedPassword: string, storedPassword: string) => {
    const [hashedPassword, salt] = storedPassword.split(".");
    const hashedPasswordBuf = Buffer.from(hashedPassword, "hex");
    const suppliedPasswordBuf = (await scryptAsync(
      suppliedPassword,
      salt,
      64
    )) as Buffer;
    return timingSafeEqual(hashedPasswordBuf, suppliedPasswordBuf);
  },
};

// Standard error analysis function
function getAuthErrorMessage(error: Error, context: string): string {
  const baseMessage = "Authentication failed";

  // Common error patterns
  if (error.message.includes("duplicate key")) {
    return "This username is already taken";
  }
  if (error.message.includes("database")) {
    return "Unable to access user data. Please try again later";
  }
  if (context === "Login authentication" && error.message.includes("password")) {
    return "Invalid username or password";
  }

  console.error(`Auth error in ${context}:`, {
    message: error.message,
    stack: error.stack
  });

  return `${baseMessage}. Please try again later`;
}

// extend express user object with our schema
declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
      email: string;
      password: string;
      contactNumber?: string;
      department?: string;
      role?: string;
    }
  }
}

export async function setupAuth(app: Express) {
  // Test database connection before setting up auth
  const isConnected = await testConnection();
  if (!isConnected) {
    throw new Error("Failed to connect to database during auth setup");
  }

  const MemoryStore = createMemoryStore(session);
  const sessionSettings: session.SessionOptions = {
    secret: process.env.REPL_ID || "purchase-management-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
    store: new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    }),
  };

  if (app.get("env") === "production") {
    app.set("trust proxy", 1);
    sessionSettings.cookie = {
      secure: true,
      maxAge: 24 * 60 * 60 * 1000,
    };
  }

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const isDbConnected = await testConnection();
        if (!isDbConnected) {
          throw new Error("Database connection not available");
        }

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.username, username))
          .limit(1);

        if (!user) {
          return done(null, false, { message: "Incorrect username." });
        }

        const isMatch = await crypto.compare(password, user.password);
        if (!isMatch) {
          return done(null, false, { message: "Incorrect password." });
        }

        return done(null, user);
      } catch (err: any) {
        const errorMessage = getAuthErrorMessage(err, "Login attempt");
        console.error("Login error:", {
          message: err.message,
          stack: err.stack
        });
        return done(err);
      }
    })
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const isDbConnected = await testConnection();
      if (!isDbConnected) {
        throw new Error("Database connection not available");
      }

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      if (!user) {
        return done(new Error("User not found"));
      }

      done(null, user);
    } catch (err: any) {
      const errorMessage = getAuthErrorMessage(err, "Session restoration");
      console.error("Session restoration error:", {
        message: err.message,
        stack: err.stack
      });
      done(err);
    }
  });

  app.post("/api/login", async (req, res, next) => {
    try {
      const result = loginSchema.safeParse(req.body);
      if (!result.success) {
        return res
          .status(400)
          .json({
            error: "Invalid input",
            details: result.error.issues.map(i => i.message)
          });
      }

      passport.authenticate("local", (err: any, user: Express.User | false, info: IVerifyOptions) => {
        try {
          if (err) {
            const errorMessage = getAuthErrorMessage(err, "Login authentication");
            console.error("Authentication error:", {
              message: err.message,
              stack: err.stack
            });
            return res.status(500).json({
              error: "Authentication failed",
              message: errorMessage
            });
          }

          if (!user) {
            return res.status(401).json({
              error: "Login failed",
              message: info.message || "Invalid credentials"
            });
          }

          req.logIn(user, (loginErr) => {
            if (loginErr) {
              const errorMessage = getAuthErrorMessage(loginErr, "Login session creation");
              console.error("Login session error:", {
                message: loginErr.message,
                stack: loginErr.stack
              });
              return res.status(500).json({
                error: "Login session failed",
                message: errorMessage
              });
            }

            return res.json({
              message: "Login successful",
              user: {
                id: user.id,
                username: user.username,
                email: user.email,
                contactNumber: user.contactNumber,
                department: user.department,
                role: user.role,
              },
            });
          });
        } catch (authError: any) {
          const errorMessage = getAuthErrorMessage(authError, "Login process");
          console.error("Login process error:", {
            message: authError.message,
            stack: authError.stack
          });
          next(authError);
        }
      })(req, res, next);
    } catch (error: any) {
      const errorMessage = getAuthErrorMessage(error, "Login request processing");
      console.error("Login request error:", {
        message: error.message,
        stack: error.stack
      });
      next(error);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const result = insertUserSchema.safeParse(req.body);
      if (!result.success) {
        return res
          .status(400)
          .json({
            error: "Invalid input",
            details: result.error.issues.map(i => i.message)
          });
      }

      const { username, password, email, contactNumber, department, role } = result.data;

      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (existingUser) {
        return res.status(400).json({
          error: "Registration failed",
          message: "Username already exists"
        });
      }

      const hashedPassword = await crypto.hash(password);

      const [newUser] = await db
        .insert(users)
        .values({
          username,
          password: hashedPassword,
          email,
          contactNumber,
          department,
          role: role || "user",
        })
        .returning();

      req.login(newUser, (err) => {
        if (err) {
          return next(err);
        }
        return res.json({
          message: "Registration successful",
          user: {
            id: newUser.id,
            username: newUser.username,
            email: newUser.email,
            contactNumber: newUser.contactNumber,
            department: newUser.department,
            role: newUser.role,
          },
        });
      });
    } catch (error: any) {
      const errorMessage = getAuthErrorMessage(error, "Registration");
      console.error("Registration error:", {
        message: error.message,
        stack: error.stack
      });
      next(error);
    }
  });

  app.post("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({
          error: "Logout failed",
          message: "Failed to end session"
        });
      }
      res.json({ message: "Logout successful" });
    });
  });

  app.get("/api/user", (req, res) => {
    if (req.isAuthenticated()) {
      const user = req.user;
      return res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        contactNumber: user.contactNumber,
        department: user.department,
        role: user.role,
      });
    }
    res.status(401).json({
      error: "Not authenticated",
      message: "Please log in to access this resource"
    });
  });
}