import { db } from "@db";
import { users } from "@db/schema";
import { eq } from "drizzle-orm";
import { compare, hash } from "bcrypt";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";

export const mandatoryDepartments = ["Finance", "CEO Office", "Director"];

export function configurePassport(passport: passport.Authenticator) {
  passport.use(new LocalStrategy(async (username, password, done) => {
    try {
      console.log('Attempting login for username:', username);

      // Explicitly select all fields we need
      const [user] = await db
        .select({
          id: users.id,
          username: users.username,
          password: users.password,
          department: users.department,
          role: users.role,
          email: users.email
        })
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (!user) {
        console.log('No user found with username:', username);
        return done(null, false, { message: 'Invalid username or password' });
      }

      console.log('User found:', { id: user.id, username: user.username, department: user.department });

      try {
        const isValid = await compare(password, user.password);
        console.log('Password validation result:', isValid);

        if (!isValid) {
          console.log('Invalid password for user:', username);
          return done(null, false, { message: 'Invalid username or password' });
        }

        // Create a sanitized user object without the password
        const sanitizedUser = {
          id: user.id,
          username: user.username,
          department: user.department,
          role: user.role,
          email: user.email
        };

        console.log('Authentication successful for user:', username);
        return done(null, sanitizedUser);
      } catch (error) {
        console.error('Password comparison error:', error);
        return done(error);
      }
    } catch (error) {
      console.error('Database query error:', error);
      return done(error);
    }
  }));

  passport.serializeUser((user: any, done) => {
    try {
      console.log('Serializing user:', user.id);
      done(null, user.id);
    } catch (error) {
      console.error('User serialization error:', error);
      done(error);
    }
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      console.log('Deserializing user ID:', id);

      const [user] = await db
        .select({
          id: users.id,
          username: users.username,
          department: users.department,
          role: users.role,
          email: users.email
        })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      if (!user) {
        console.error('Failed to deserialize user - not found:', id);
        return done(null, false);
      }

      console.log('User deserialized successfully:', user.username);
      done(null, user);
    } catch (error) {
      console.error('User deserialization error:', error);
      done(error);
    }
  });
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
    // Get user details with error handling
    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      console.log('User not found for approval check:', userId);
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

export async function createTestUser() {
  try {
    const hashedPassword = await hash('admin123', 10);
    const [user] = await db
      .insert(users)
      .values({
        username: 'testadmin',
        password: hashedPassword,
        department: 'CEO Office',
        role: 'admin',
        email: 'testadmin@example.com',
      })
      .onConflictDoUpdate({
        target: users.username,
        set: {
          password: hashedPassword
        }
      })
      .returning();

    console.log('Test user created/updated successfully');
    return user;
  } catch (error) {
    console.error('Failed to create test user:', error);
    throw error;
  }
}