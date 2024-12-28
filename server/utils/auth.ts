import { db } from "@db";
import { users } from "@db/schema";
import { eq } from "drizzle-orm";
import { compare, hash } from "bcrypt";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";

export const mandatoryDepartments = ["Finance", "CEO Office", "Director"];

export async function configurePassport(passport: passport.Authenticator) {
  // Configure LocalStrategy
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        console.log('LocalStrategy: Attempting authentication for username:', username);

        // Find user in database
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.username, username))
          .limit(1);

        if (!user) {
          console.log('LocalStrategy: User not found:', username);
          return done(null, false, { message: 'Invalid username or password' });
        }

        console.log('LocalStrategy: User found, verifying password');

        // Verify password
        const isValidPassword = await compare(password, user.password);

        if (!isValidPassword) {
          console.log('LocalStrategy: Invalid password for user:', username);
          return done(null, false, { message: 'Invalid username or password' });
        }

        console.log('LocalStrategy: Password verified successfully');

        // Create sanitized user object (without password)
        const sanitizedUser = {
          id: user.id,
          username: user.username,
          department: user.department,
          role: user.role,
          email: user.email,
          contactNumber: user.contact_number
        };

        return done(null, sanitizedUser);
      } catch (error) {
        console.error('LocalStrategy: Authentication error:', error);
        return done(error);
      }
    })
  );

  // User serialization for session
  passport.serializeUser((user: Express.User, done) => {
    console.log('Serializing user:', user.id);
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
          contact_number: users.contact_number
        })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      if (!user) {
        console.log('Deserialization failed: User not found:', id);
        return done(null, false);
      }

      console.log('User deserialized successfully:', user.username);
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
        contact_number: '123456789'
      })
      .onConflictDoUpdate({
        target: users.username,
        set: {
          password: hashedPassword,
          contact_number: '123456789'
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