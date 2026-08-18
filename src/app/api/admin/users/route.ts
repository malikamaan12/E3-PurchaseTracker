import { NextRequest, NextResponse } from "next/server";
import { db } from "@db";
import { users } from "@db/schema";
import { eq, desc } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth-next";
import * as bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/users
 * List all users.
 * Access: Admin only.
 */
export async function GET(req: NextRequest) {
  try {
    const admin = await getAuthenticatedUser(req);
    if (!admin) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    if (admin.role !== 'admin' && admin.role !== 'super_admin') {
      return NextResponse.json({ error: "Access denied. Admin only route." }, { status: 403 });
    }

    const allUsers = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        department: users.department,
        role: users.role,
        canManageVendors: users.canManageVendors,
        contact_number: users.contact_number,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));

    return NextResponse.json(allUsers);
  } catch (error: any) {
    console.error("[Native Admin API] Users GET Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/users
 * Create a new user.
 * Access: Admin only.
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await getAuthenticatedUser(req);
    if (!admin) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    if (admin.role !== 'admin' && admin.role !== 'super_admin') {
      return NextResponse.json({ error: "Access denied. Admin only." }, { status: 403 });
    }

    const { username, email, password, role, department, contact_number } = await req.json();

    if (!username || !email || !password || !role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check if user already exists
    const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing) {
      return NextResponse.json({ error: "User with this email already exists" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [newUser] = await db
      .insert(users)
      .values({
        username,
        email,
        password: hashedPassword,
        role,
        department: department || 'General',
        contact_number: contact_number || '',
        isActive: true,
        canManageVendors: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Don't return the password
    const { password: _, ...userWithoutPassword } = newUser;

    return NextResponse.json({ message: "User created successfully", user: userWithoutPassword });
  } catch (error: any) {
    console.error("[Native Admin API] Users POST Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
