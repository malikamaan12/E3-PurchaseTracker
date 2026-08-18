import { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { JWT_SECRET, TOKEN_COOKIE_NAME } from "./utils/config";
import { cookies } from "next/headers";
import { 
  type DepartmentAssignment, 
  type AuthenticatedUser, 
  normalizeDepartmentAssignments 
} from "./auth-shared";

export * from "./auth-shared";

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

    // Ensure department assignments and departments list are normalized
    const assignments = normalizeDepartmentAssignments(decoded.assignedDepartments, decoded.department);
    decoded.departmentAssignments = assignments;
    decoded.assignedDepartments = assignments;

    // Active departments (primary + non-frozen assigned)
    const activeAssigned = assignments
      .filter(a => a.status === 'active')
      .map(a => a.department);

    decoded.departments = Array.from(new Set([decoded.department, ...activeAssigned].filter(Boolean)));

    return decoded;
  } catch (error) {
    return null;
  }
}
