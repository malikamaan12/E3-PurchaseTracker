import { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { JWT_SECRET, TOKEN_COOKIE_NAME } from "./utils/config";

export interface AuthenticatedUser {
  id: number;
  username: string;
  role: 'admin' | 'approver' | 'user';
  department: string;
  isApprover?: boolean;
  canManageVendors?: boolean; // New permission flag
}

import { cookies } from "next/headers";

export async function getAuthenticatedUser(req?: NextRequest): Promise<AuthenticatedUser | null> {
  try {
    let token = req?.cookies.get(TOKEN_COOKIE_NAME)?.value;
    if (!token) {
      const cookieStore = await cookies().catch(() => null);
      token = cookieStore?.get(TOKEN_COOKIE_NAME)?.value;
    }

    if (!token) return null;

    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    const decoded = payload as unknown as AuthenticatedUser;
    
    // Basic validation of decoded token structure
    if (!decoded || !decoded.id || !decoded.role) {
      return null;
    }

    return decoded;
  } catch (error) {
    // We swallow verification errors here to simply return null for unauthenticated users,
    // which is the expected behavior for this helper.
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
