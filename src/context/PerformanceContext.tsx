"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useMemo } from "react";

interface PerformanceContextValue {
  highPerformanceMode: boolean;
  setHighPerformanceMode: (enabled: boolean) => void;
}

const PerformanceContext = createContext<PerformanceContextValue>({
  highPerformanceMode: false,
  setHighPerformanceMode: () => {},
});

export function PerformanceProvider({ children }: { children: ReactNode }) {
  const [highPerformanceMode, setHighPerformanceModeState] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("high-performance-mode");
    if (saved === "true") {
      setHighPerformanceModeState(true);
    } else if (saved === null && typeof window !== "undefined") {
      // Auto-detect mobile to enable high performance mode by default
      const isMobile = window.innerWidth <= 768 || /Mobi|Android/i.test(navigator.userAgent);
      if (isMobile) {
        setHighPerformanceModeState(true);
      }
    }
  }, []);

  const setHighPerformanceMode = (enabled: boolean) => {
    setHighPerformanceModeState(enabled);
    localStorage.setItem("high-performance-mode", enabled ? "true" : "false");
  };

  const value = useMemo(() => ({
    highPerformanceMode,
    setHighPerformanceMode,
  }), [highPerformanceMode]);

  return (
    <PerformanceContext.Provider value={value}>
      {children}
    </PerformanceContext.Provider>
  );
}

export function usePerformance() {
  const context = useContext(PerformanceContext);
  if (context === undefined) {
    throw new Error("usePerformance must be used within a PerformanceProvider");
  }
  return context;
}
