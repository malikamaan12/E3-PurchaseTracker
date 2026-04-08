"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "sonner";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/context/AuthContext";
import { PerformanceProvider } from "@/context/PerformanceContext";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <PerformanceProvider>
          <AuthProvider>
            {children}
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
