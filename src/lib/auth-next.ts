import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import { JWT_SECRET, TOKEN_COOKIE_NAME } from "./utils/config";

export interface AuthenticatedUser {
  id: number;
  username: string;
  role: 'admin' | 'approver' | 'user';
  department: string;
  isApprover?: boolean;
  canManageVendors?: boolean; // New permission flag
}

/**
 * Extracts and verifies the authenticated user from the request cookies.
 * Returns the user object if valid, or null if unauthenticated.
 */
export async function getAuthenticatedUser(req: NextRequest): Promise<AuthenticatedUser | null> {
  try {
    const cookieHeader = req.headers.get("cookie") || "";
    const cookies: Record<string, string> = {};
    
    cookieHeader.split(";").forEach((c) => {
      const [key, value] = c.split("=").map((s) => s.trim());
      if (key && value) cookies[key] = value;
    });

    const token = cookies[TOKEN_COOKIE_NAME];
    if (!token) return null;

    const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
    
    // Basic validation of decoded token structure
    if (!decoded || !decoded.id || !decoded.role) {
      return null;
    }

    return decoded;
  } catch (error) {
    console.error("[Auth Helper] Token verification failed:", error);
    return null;
  }
}

/**
 * Helper to check for specific roles in Next.js API routes.
 */
export function hasRole(user: AuthenticatedUser, ...roles: string[]): boolean {
  return roles.includes(user.role);
}

/**
 * Helper to check for approver authority (admin or isApprover flag).
 */
export function hasApprovalAuthority(user: AuthenticatedUser): boolean {
  return user.role === 'admin' || user.isApprover === true;
}
