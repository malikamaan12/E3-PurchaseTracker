import { db } from "@db";
import { users, approvals } from "@db/schema";
import { eq, and } from "drizzle-orm";
import { compare, hash } from "bcryptjs";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";

export const mandatoryDepartments = ["Finance", "CEO Office", "Director"];

// Extend Express.User interface
declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
      department: string;
      role: string;
      email: string;
      contactNumber: string;
      isActive: boolean;
    }
  }
}

export async function configurePassport(passport: passport.Authenticator) {
  // Configure LocalStrategy
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        console.log('LocalStrategy: Authentication attempt:', { username });

        // Find user in database with detailed logging
        const userResult = await db
          .select()
          .from(users)
          .where(eq(users.username, username))
          .limit(1);

        console.log('LocalStrategy: Database query result:', {
          found: userResult.length > 0,
          username
        });

        const [user] = userResult;

        if (!user) {
          console.log('LocalStrategy: User not found:', username);
          return done(null, false, { message: 'Invalid username or password' });
        }

        console.log('LocalStrategy: User found, verifying password');

        // Verify password with detailed logging
        let isValidPassword = false;
        try {
          isValidPassword = await compare(password, user.password);
          console.log('LocalStrategy: Password verification result:', { 
            username,
            isValid: isValidPassword 
          });
        } catch (error) {
          console.error('LocalStrategy: Password comparison error:', error);
          return done(error);
        }

        if (!isValidPassword) {
          console.log('LocalStrategy: Invalid password for user:', username);
          return done(null, false, { message: 'Invalid username or password' });
        }

        console.log('LocalStrategy: Authentication successful for user:', {
          id: user.id,
          username: user.username,
          department: user.department,
          role: user.role
        });

        // Create sanitized user object (without password)
        const sanitizedUser: Express.User = {
          id: user.id,
          username: user.username,
          department: user.department,
          role: user.role,
          email: user.email,
          contactNumber: user.contact_number,
          isActive: user.isActive
        };

        return done(null, sanitizedUser);
      } catch (error) {
        console.error('LocalStrategy: Unexpected error during authentication:', error);
        return done(error);
      }
    })
  );

  // User serialization for session
  passport.serializeUser((user: Express.User, done) => {
    console.log('Serializing user:', {
      id: user.id,
      username: user.username
    });
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
          contactNumber: users.contact_number,
          isActive: users.isActive
        })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      if (!user) {
        console.log('Deserialization failed: User not found:', id);
        return done(null, false);
      }

      console.log('User deserialized successfully:', {
        id: user.id,
        username: user.username
      });

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

    console.log('Test user created/updated successfully:', {
      id: user.id,
      username: user.username
    });
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
    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      console.log('User not found for approval check:', userId);
      return false;
    }

    // Admin or mandatory department approvers can approve all requests
    if (user.role === 'admin' || mandatoryDepartments.includes(user.department)) {
      return true;
    }

    // Check if user is assigned as an approver for this request
    const approval = await db.query.approvals.findFirst({
      where: and(
        eq(approvals.requestId, requestId),
        eq(approvals.approverId, userId)
      )
    });

    if (approval) {
      // User is explicitly assigned as an approver
      return true;
    }
    
    // Check if user's department is assigned to approve this request
    const departmentApproval = await db.query.approvals.findFirst({
      where: and(
        eq(approvals.requestId, requestId),
        eq(approvals.department, user.department)
      )
    });
    
    if (departmentApproval) {
      return true;
    }

    return false;
  } catch (error) {
    console.error("Error checking user approval rights:", error);
    return false;
  }
}