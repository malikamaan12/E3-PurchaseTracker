"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "sonner";
import { ThemeProvider, useTheme } from "next-themes";
import { AuthProvider } from "@/context/AuthContext";
import { PerformanceProvider } from "@/context/PerformanceContext";
import { PWAProvider } from "@/context/PWAContext";
import { NotificationToastWatcher } from "@/components/notifications/NotificationToastWatcher";

import { useEffect } from "react";

function ThemeAwareToaster() {
  const { theme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  if (!mounted) {
    return null;
  }

  // Resolve system theme to actual theme if 'system' is selected
  const currentTheme = theme === 'system' ? systemTheme : theme;
  
  return (
    <Toaster 
      position="bottom-right" 
      richColors 
      closeButton
      expand={false}
      theme={(currentTheme as "light" | "dark") || "dark"}
      offset="24px"
      gap={10}
      toastOptions={{
        duration: 4000,
        classNames: {
          toast: "bg-card/95 backdrop-blur-xl border border-border/80 shadow-2xl rounded-2xl p-4 font-sans text-xs ring-1 ring-border/50",
          title: "font-bold text-foreground text-sm tracking-tight",
          description: "text-muted-foreground text-xs leading-relaxed mt-0.5",
          actionButton: "!bg-primary !text-primary-foreground font-semibold !text-xs !rounded-xl !px-3.5 !py-2 hover:!opacity-90 transition-all shadow-md shadow-primary/20",
          cancelButton: "!bg-secondary !text-secondary-foreground font-semibold !text-xs !rounded-xl !px-3.5 !py-2 hover:!bg-secondary/80 transition-colors",
          closeButton: "!bg-background !border !border-border !text-muted-foreground hover:!text-foreground !rounded-lg",
        },
      }}
    />
  );
}

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
        staleTime: 30000,            // 30 seconds — lookup data rarely changes mid-session
        gcTime: 10 * 60 * 1000,      // 10 min — keep unused cache entries longer to speed up back-navigation
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
            <NotificationToastWatcher />
            <ThemeAwareToaster />
          </AuthProvider>
        </PerformanceProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
