"use client";

import { createContext, useContext, useEffect, useState, useCallback, useMemo, ReactNode } from "react";
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
  isAdmin: boolean;
  isApprover: boolean;
  refetch: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isAdmin: false,
  isApprover: false,
  refetch: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/user", { credentials: "include" });
      if (!res.ok) {
        setUser(null);
        if (res.status === 401) {
          const isAuthPage = pathname?.startsWith("/login") || pathname?.startsWith("/signup");
          if (!isAuthPage) {
            router.replace("/login?expired=true");
          }
        }
        return;
      }
      const data = await res.json();
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const isAdmin = user?.role?.toLowerCase() === "admin";
  const isApprover = user?.role?.toLowerCase() === "approver" || user?.isApprover === true;

  const value = useMemo(() => ({
    user,
    isLoading,
    isAdmin,
    isApprover,
    refetch: fetchUser,
  }), [user, isLoading, isAdmin, isApprover, fetchUser]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
