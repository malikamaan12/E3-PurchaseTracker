import passport from "passport";
import { IVerifyOptions, Strategy as LocalStrategy } from "passport-local";
import { type Express } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { users, type SelectUser } from "@db/schema";
import { db } from "@db";
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

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

export function setupAuth(app: Express) {
  const MemoryStore = createMemoryStore(session);
  const sessionSettings: session.SessionOptions = {
    secret: process.env.REPL_ID || "purchase-management-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {},
    store: new MemoryStore({
      checkPeriod: 86400000,
    }),
  };

  if (app.get("env") === "production") {
    app.set("trust proxy", 1);
    sessionSettings.cookie = {
      secure: true,
    };
  }

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        console.log("Attempting login for username:", username);
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.username, username))
          .limit(1);

        if (!user) {
          console.log("User not found:", username);
          return done(null, false, { 
            message: "Account not found. Please check your username or register if you don't have an account." 
          });
        }

        const isMatch = await crypto.compare(password, user.password);
        if (!isMatch) {
          console.log("Password mismatch for user:", username);
          return done(null, false, { 
            message: "Incorrect password. Please try again or use the forgot password option." 
          });
        }

        console.log("Login successful for user:", username);
        return done(null, user);
      } catch (err) {
        console.error("Login error:", err);
        return done(err);
      }
    })
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/login", (req, res, next) => {
    console.log("Login request received:", req.body);

    if (!req.body.username || !req.body.password) {
      return res.status(400).json({
        status: "error",
        message: "Please provide both username and password"
      });
    }

    passport.authenticate("local", (err: any, user: Express.User | false, info: IVerifyOptions) => {
      if (err) {
        console.error("Login authentication error:", err);
        return res.status(500).json({
          status: "error",
          message: "An unexpected error occurred. Please try again later."
        });
      }

      if (!user) {
        console.log("Login failed:", info.message);
        return res.status(400).json({
          status: "error",
          message: info.message ?? "Login failed. Please check your credentials."
        });
      }

      req.logIn(user, (err) => {
        if (err) {
          console.error("Login session error:", err);
          return res.status(500).json({
            status: "error",
            message: "Failed to create login session. Please try again."
          });
        }

        console.log("Login successful for user:", user.username);
        return res.json({
          status: "success",
          message: "Login successful! Welcome back.",
          user: {
            id: user.id,
            username: user.username,
            department: user.department,
            role: user.role,
          },
        });
      });
    })(req, res, next);
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const { username, password, email, contactNumber, department, role } = req.body;

      // Validate required fields
      if (!username || !password || !email || !contactNumber || !department) {
        return res.status(400).json({
          status: "error",
          message: "Please fill in all required fields"
        });
      }

      // Check if user already exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (existingUser) {
        return res.status(400).json({
          status: "error",
          message: "Username already exists. Please choose a different username."
        });
      }

      // Hash the password
      const hashedPassword = await crypto.hash(password);

      // Create the new user
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

      // Log the user in after registration
      req.login(newUser, (err) => {
        if (err) {
          return res.status(500).json({
            status: "error",
            message: "Registration successful but failed to log in automatically. Please try logging in."
          });
        }
        return res.json({
          status: "success",
          message: "Registration successful! Welcome to the system.",
          user: {
            id: newUser.id,
            username: newUser.username,
            department: newUser.department,
            role: newUser.role,
          },
        });
      });
    } catch (error: any) {
      console.error("Registration error:", error);
      return res.status(500).json({
        status: "error",
        message: "An unexpected error occurred during registration. Please try again."
      });
    }
  });

  app.post("/api/logout", (req, res) => {
    const username = req.user?.username;
    req.logout((err) => {
      if (err) {
        return res.status(500).json({
          status: "error",
          message: "Failed to log out. Please try again."
        });
      }
      res.json({
        status: "success",
        message: `Goodbye${username ? `, ${username}` : ''}! You've been logged out successfully.`
      });
    });
  });

  app.get("/api/user", (req, res) => {
    if (req.isAuthenticated()) {
      const user = req.user as Express.User;
      return res.json({
        id: user.id,
        username: user.username,
        department: user.department,
        role: user.role,
      });
    }
    res.status(401).json({
      status: "error",
      message: "Not logged in. Please sign in to continue."
    });
  });
}