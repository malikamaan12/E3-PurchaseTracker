"use client";

import { createContext, useContext, useEffect, useState, useCallback, useMemo, ReactNode, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";

export interface DepartmentAssignment {
  department: string;
  role: 'user' | 'approver' | 'both';
  status: 'active' | 'frozen';
}

export interface AuthUser {
  id: number;
  username: string;
  department: string;
  assignedDepartments?: Array<string | DepartmentAssignment>;
  departmentAssignments?: DepartmentAssignment[];
  departments?: string[];
  role: string;
  email: string;
  isActive: boolean;
  isApprover: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isRevalidating: boolean; // Exposed for subtle UI indicators if needed
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isApprover: boolean;
  isSupervisor: boolean;
  departments: string[];
  departmentAssignments: DepartmentAssignment[];
  submissionDepartments: string[];
  canActInDepartment: (dept: string) => boolean;
  canCreateInDepartment: (dept: string) => boolean;
  canApproveInDepartment: (dept: string) => boolean;
  isDepartmentFrozen: (dept: string) => boolean;
  refetch: () => void;
  setUser: (user: AuthUser | null) => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isRevalidating: false,
  isSuperAdmin: false,
  isAdmin: false,
  isApprover: false,
  isSupervisor: false,
  departments: [],
  departmentAssignments: [],
  submissionDepartments: [],
  canActInDepartment: () => false,
  canCreateInDepartment: () => false,
  canApproveInDepartment: () => false,
  isDepartmentFrozen: () => false,
  refetch: () => {},
  setUser: () => {},
});

// TTL: 5 minutes in ms
const AUTH_TTL_MS = 5 * 60 * 1000;

export function AuthProvider({ 
  children, 
  initialUser = null 
}: { 
  children: ReactNode;
  initialUser?: AuthUser | null;
}) {
  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const [isLoading, setIsLoading] = useState(!initialUser);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const lastVerifyTime = useRef<number>(initialUser ? Date.now() : 0);
  
  const router = useRouter();
  const initialUserId = initialUser?.id;

  // STABLE FETCH: Non-blocking background revalidation
  const fetchUser = useCallback(async (isSilent = false) => {
    // If user already exists in state or SSR, never block the UI with full-screen loading
    if (user || initialUser) {
      isSilent = true;
    }

    // Check TTL if silent re-verification
    if (isSilent && Date.now() - lastVerifyTime.current < AUTH_TTL_MS) {
      setIsLoading(false);
      return;
    }

    if (!isSilent) setIsLoading(true);
    else setIsRevalidating(true);

    const controller = new AbortController();
    const safetyTimeout = setTimeout(() => {
      controller.abort();
      setIsLoading(false);
      setIsRevalidating(false);
    }, 4000); // 4s guardrail

    try {
      const currentPath = typeof window !== "undefined" ? window.location.pathname : "";
      const isAuthPage = currentPath.startsWith("/login") || currentPath.startsWith("/signup");

      // BOOT GUARD: If we are on the login page and it's a silent check, don't interfere
      if (isAuthPage && isSilent) {
        setIsLoading(false);
        setIsRevalidating(false);
        return;
      }

      const res = await fetch("/api/auth/user", { 
        credentials: "include",
        signal: controller.signal
      });

      if (!res.ok) {
        if (res.status === 401) {
          setUser(null);
          if (!isAuthPage && typeof window !== "undefined") {
            window.location.href = "/login?expired=true";
          }
        }
        return;
      }

      const data = await res.json();
      setUser(data);
      lastVerifyTime.current = Date.now();
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        console.error("[Auth] Background synchronization failure:", err);
      }
    } finally {
      clearTimeout(safetyTimeout);
      setIsLoading(false);
      setIsRevalidating(false);
    }
  }, [initialUser, user]);

  useEffect(() => {
    fetchUser(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isSuperAdmin = useMemo(() => user?.role?.toLowerCase() === "super_admin", [user]);
  const isAdmin = useMemo(() => user?.role?.toLowerCase() === "admin" || user?.role?.toLowerCase() === "super_admin", [user]);
  const isSupervisor = useMemo(() => user?.role?.toLowerCase() === "supervisor", [user]);
  const isApprover = useMemo(() => {
    if (!user || user.role?.toLowerCase() === "supervisor" || user.role?.toLowerCase() === "user") {
      return false;
    }
    return user.role?.toLowerCase() === "approver" || user.isApprover === true;
  }, [user]);

  const departmentAssignments = useMemo<DepartmentAssignment[]>(() => {
    if (!user) return [];
    if (Array.isArray(user.departmentAssignments)) return user.departmentAssignments;
    if (!Array.isArray(user.assignedDepartments)) return [];
    
    return user.assignedDepartments.map(item => {
      if (typeof item === 'string') {
        return { department: item, role: 'both' as const, status: 'active' as const };
      }
      return {
        department: item.department || '',
        role: (item.role || 'both') as 'user' | 'approver' | 'both',
        status: (item.status || 'active') as 'active' | 'frozen',
      };
    }).filter(a => !!a.department);
  }, [user]);

  const userDepartments = useMemo(() => {
    if (!user) return [];
    const activeAssigned = departmentAssignments
      .filter(a => a.status === 'active')
      .map(a => a.department);
    return Array.from(new Set([user.department, ...activeAssigned].filter(Boolean)));
  }, [user, departmentAssignments]);

  const submissionDepartments = useMemo(() => {
    if (!user) return [];
    const allowed = departmentAssignments
      .filter(a => a.status === 'active' && (a.role === 'user' || a.role === 'both'))
      .map(a => a.department);
    return Array.from(new Set([user.department, ...allowed].filter(Boolean)));
  }, [user, departmentAssignments]);

  const canActInDepartment = useCallback((targetDept: string) => {
    if (!user) return false;
    if (user.role?.toLowerCase() === 'super_admin') return true;
    const depts = userDepartments.map(d => d.toLowerCase().trim());
    return depts.includes(targetDept.toLowerCase().trim());
  }, [user, userDepartments]);

  const canCreateInDepartment = useCallback((targetDept: string) => {
    if (!user) return false;
    if (user.role?.toLowerCase() === 'super_admin') return true;
    const target = targetDept.toLowerCase().trim();
    if ((user.department || '').toLowerCase().trim() === target) return true;
    const match = departmentAssignments.find(a => a.department.toLowerCase().trim() === target);
    return !!match && match.status === 'active' && (match.role === 'user' || match.role === 'both');
  }, [user, departmentAssignments]);

  const canApproveInDepartment = useCallback((targetDept: string) => {
    if (!user) return false;
    if (user.role?.toLowerCase() === 'supervisor' || user.role?.toLowerCase() === 'user') return false;
    if (user.role?.toLowerCase() === 'super_admin' || user.role?.toLowerCase() === 'admin') return true;
    const target = targetDept.toLowerCase().trim();
    if ((user.department || '').toLowerCase().trim() === target) {
      return user.role?.toLowerCase() === 'approver' || user.isApprover === true;
    }
    const match = departmentAssignments.find(a => a.department.toLowerCase().trim() === target);
    return !!match && match.status === 'active' && (match.role === 'approver' || match.role === 'both');
  }, [user, departmentAssignments]);

  const isDepartmentFrozen = useCallback((targetDept: string) => {
    const target = targetDept.toLowerCase().trim();
    const match = departmentAssignments.find(a => a.department.toLowerCase().trim() === target);
    return !!match && match.status === 'frozen';
  }, [departmentAssignments]);

  const value = useMemo(() => ({
    user,
    isLoading,
    isRevalidating,
    isSuperAdmin,
    isAdmin,
    isApprover,
    isSupervisor,
    departments: userDepartments,
    departmentAssignments,
    submissionDepartments,
    canActInDepartment,
    canCreateInDepartment,
    canApproveInDepartment,
    isDepartmentFrozen,
    refetch: () => fetchUser(false),
    setUser,
  }), [
    user, 
    isLoading, 
    isRevalidating, 
    isSuperAdmin, 
    isAdmin, 
    isApprover, 
    isSupervisor, 
    userDepartments, 
    departmentAssignments, 
    submissionDepartments, 
    canActInDepartment, 
    canCreateInDepartment, 
    canApproveInDepartment, 
    isDepartmentFrozen, 
    fetchUser
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
