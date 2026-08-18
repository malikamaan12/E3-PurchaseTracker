"use client";

import { createContext, useContext, useEffect, useState, useCallback, useMemo, ReactNode, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";

export interface AuthUser {
  id: number;
  username: string;
  department: string;
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

  // STABLE FETCH: Using primitive ID in dependencies to prevent object-reference loops
  const fetchUser = useCallback(async (isSilent = false) => {
    // Check TTL if silent re-verification
    if (isSilent && Date.now() - lastVerifyTime.current < AUTH_TTL_MS) {
      if (!isSilent) setIsLoading(false);
      return;
    }

    if (!isSilent) setIsLoading(true);
    else setIsRevalidating(true);

    const safetyTimeout = setTimeout(() => {
      setIsLoading(false);
      setIsRevalidating(false);
    }, 8000); // 8s safety guardrail

    try {
      const currentPath = window.location.pathname;
      const isAuthPage = currentPath.startsWith("/login") || currentPath.startsWith("/signup");

      // BOOT GUARD: If we are on the login page and it's a silent check, don't interfere
      if (isAuthPage && isSilent) {
        setIsLoading(false);
        setIsRevalidating(false);
        return;
      }

      const res = await fetch("/api/auth/user", { credentials: "include" });
      if (!res.ok) {
        setUser(null);
        if (res.status === 401) {
          const currentPath = window.location.pathname;
          const isAuthPage = currentPath.startsWith("/login") || currentPath.startsWith("/signup");
          
          if (!isAuthPage) {
            // Only redirect if we don't have a valid session anymore.
            router.replace("/login?expired=true");
          }
        }
        return;
      }
      const data = await res.json();
      setUser(data);
      lastVerifyTime.current = Date.now();
    } catch (err) {
      console.error("[Auth] Background synchronization failure:", err);
      // Keep existing user on network error if it was hydrated
      if (!initialUserId) setUser(null);
    } finally {
      clearTimeout(safetyTimeout);
      setIsLoading(false);
      setIsRevalidating(false);
    }
  }, [router, initialUserId]);

  useEffect(() => {
    // Runs on mount. Silent if SSR provided a user (initialUserId is truthy).
    fetchUser(!!initialUserId);
  }, [fetchUser]); // eslint-disable-line react-hooks/exhaustive-deps

  const isSuperAdmin = useMemo(() => user?.role?.toLowerCase() === "super_admin", [user]);
  const isAdmin = useMemo(() => user?.role?.toLowerCase() === "admin" || user?.role?.toLowerCase() === "super_admin", [user]);
  const isApprover = useMemo(() => user?.role?.toLowerCase() === "approver" || user?.isApprover === true, [user]);

  const value = useMemo(() => ({
    user,
    isLoading,
    isRevalidating,
    isSuperAdmin,
    isAdmin,
    isApprover,
    refetch: () => fetchUser(false),
    setUser,
  }), [user, isLoading, isRevalidating, isSuperAdmin, isAdmin, isApprover, fetchUser]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
