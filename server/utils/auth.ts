import { db } from "@db";
import { users } from "@db/schema";
import { eq } from "drizzle-orm";
import { compare } from "bcrypt";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";

export const mandatoryDepartments = ["Finance", "CEO Office", "Director"];

export function configurePassport(passport: passport.Authenticator) {
  // Configure passport local strategy
  passport.use(new LocalStrategy(async (username, password, done) => {
    try {
      // Find user by username
      const [user] = await db.select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (!user) {
        return done(null, false, { message: 'Invalid username or password' });
      }

      // Verify password
      const isValid = await compare(password, user.password);
      if (!isValid) {
        return done(null, false, { message: 'Invalid username or password' });
      }

      return done(null, user);
    } catch (error) {
      return done(error);
    }
  }));

  // Configure session serialization
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const [user] = await db.select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      if (!user) {
        return done(null, false);
      }

      done(null, user);
    } catch (error) {
      done(error);
    }
  });
}

export async function canUserApprove(userId: number, requestId: number): Promise<boolean> {
  try {
    // Get user details
    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return false;
    }

    // Check if user is admin or from mandatory departments
    if (user.role === 'admin' || mandatoryDepartments.includes(user.department)) {
      return true;
    }

    return false;
  } catch (error) {
    console.error("Error checking user approval rights:", error);
    return false;
  }
}