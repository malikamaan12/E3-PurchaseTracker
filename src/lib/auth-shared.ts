export interface DepartmentAssignment {
  department: string;
  role: 'user' | 'approver' | 'both';
  status: 'active' | 'frozen';
}

export interface AuthenticatedUser {
  id: number;
  username: string;
  role: 'super_admin' | 'admin' | 'approver' | 'supervisor' | 'user';
  department: string;
  assignedDepartments?: Array<string | DepartmentAssignment>;
  departmentAssignments?: DepartmentAssignment[];
  departments?: string[];
  isApprover?: boolean;
  canManageVendors?: boolean;
}

export function normalizeDepartmentAssignments(
  rawAssigned: any,
  primaryDept?: string
): DepartmentAssignment[] {
  if (!Array.isArray(rawAssigned)) return [];
  const primary = (primaryDept || '').trim().toLowerCase();
  
  const result: DepartmentAssignment[] = [];
  const seen = new Set<string>();

  for (const item of rawAssigned) {
    if (!item) continue;
    let deptName = '';
    let role: 'user' | 'approver' | 'both' = 'both';
    let status: 'active' | 'frozen' = 'active';

    if (typeof item === 'string') {
      deptName = item.trim();
    } else if (typeof item === 'object' && item.department) {
      deptName = String(item.department).trim();
      if (['user', 'approver', 'both'].includes(item.role)) {
        role = item.role;
      }
      if (['active', 'frozen'].includes(item.status)) {
        status = item.status;
      }
    }

    if (!deptName || deptName.toLowerCase() === primary) continue;
    const lower = deptName.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);

    result.push({ department: deptName, role, status });
  }

  return result;
}

/**
 * Helper to check for specific roles in Next.js API routes or client components.
 */
export function hasRole(user: AuthenticatedUser, ...roles: string[]): boolean {
  return roles.includes(user.role);
}

/**
 * Helper to check if a user is super_admin.
 */
export function isSuperAdmin(user: AuthenticatedUser): boolean {
  return user.role === 'super_admin';
}

/**
 * Helper to check if a user is supervisor.
 */
export function isSupervisor(user: AuthenticatedUser): boolean {
  return user.role === 'supervisor';
}

/**
 * Helper to check for approver authority (super_admin, admin or isApprover flag).
 * Supervisors and regular users NEVER have approval power.
 */
export function hasApprovalAuthority(user: AuthenticatedUser): boolean {
  if (user.role === 'supervisor' || user.role === 'user') return false;
  return user.role === 'super_admin' || user.role === 'admin' || user.role === 'approver' || !!user.isApprover;
}

/**
 * Helper to check if user has authority in a specific department.
 */
export function canActInDepartment(user: AuthenticatedUser, targetDept: string): boolean {
  if (user.role === 'super_admin') return true;
  const target = targetDept.toLowerCase().trim();
  if ((user.department || '').toLowerCase().trim() === target) return true;
  
  const assignments = user.departmentAssignments || normalizeDepartmentAssignments(user.assignedDepartments, user.department);
  const match = assignments.find(a => a.department.toLowerCase().trim() === target);
  return !!match && match.status === 'active';
}

/**
 * Helper to check if user can create/submit requests for a specific department.
 */
export function canCreateInDepartment(user: AuthenticatedUser, targetDept: string): boolean {
  if (user.role === 'super_admin') return true;
  const target = targetDept.toLowerCase().trim();
  
  // Primary department check
  if ((user.department || '').toLowerCase().trim() === target) {
    return true;
  }

  const assignments = user.departmentAssignments || normalizeDepartmentAssignments(user.assignedDepartments, user.department);
  const match = assignments.find(a => a.department.toLowerCase().trim() === target);
  if (!match) return false;

  return match.status === 'active' && (match.role === 'user' || match.role === 'both');
}

/**
 * Helper to check if user can approve requests for a specific department.
 * Supervisors and regular users NEVER have approval power in any department.
 * ONLY super_admin has universal approval authority across all departments.
 * Admins and approvers can ONLY approve for their primary department or assigned active approver departments.
 */
export function canApproveInDepartment(user: AuthenticatedUser, targetDept: string): boolean {
  if (user.role === 'supervisor' || user.role === 'user') return false;
  if (user.role === 'super_admin') return true;
  const target = targetDept.toLowerCase().trim();

  // Primary department approver / admin check
  if ((user.department || '').toLowerCase().trim() === target) {
    return user.role === 'approver' || user.role === 'admin' || !!user.isApprover;
  }

  const assignments = user.departmentAssignments || normalizeDepartmentAssignments(user.assignedDepartments, user.department);
  const match = assignments.find(a => a.department.toLowerCase().trim() === target);
  if (!match) return false;

  return match.status === 'active' && (match.role === 'approver' || match.role === 'both');
}

/**
 * Helper to check if user access to a department is frozen.
 */
export function isDepartmentFrozen(user: AuthenticatedUser, targetDept: string): boolean {
  const target = targetDept.toLowerCase().trim();
  const assignments = user.departmentAssignments || normalizeDepartmentAssignments(user.assignedDepartments, user.department);
  const match = assignments.find(a => a.department.toLowerCase().trim() === target);
  return !!match && match.status === 'frozen';
}
