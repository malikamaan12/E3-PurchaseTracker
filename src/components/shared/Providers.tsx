"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "sonner";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/context/AuthContext";
import { PerformanceProvider } from "@/context/PerformanceContext";
import { PWAProvider } from "@/context/PWAContext";

export default function Providers({ 
  children,
  initialUser = null
}: { 
  children: React.ReactNode;
  initialUser?: any;
}) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,        // 1 min — data is fresh for 1 minute
        gcTime: 5 * 60 * 1000,       // 5 min — unused cache entries are GC'd
        refetchOnWindowFocus: false,
        retry: 1,                    // Only 1 retry — prevents 3x spam on 401/403
      },
      mutations: {
        retry: false,                // Never retry mutations — prevents duplicate DB writes
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <PerformanceProvider>
          <AuthProvider initialUser={initialUser}>
            <PWAProvider>
              {children}
            </PWAProvider>
            <Toaster 
              position="top-right" 
              richColors 
              closeButton
              expand={false}
            />
          </AuthProvider>
        </PerformanceProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
