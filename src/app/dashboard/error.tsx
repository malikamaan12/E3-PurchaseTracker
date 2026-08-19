"use client";

import { ErrorFallbackView } from "@/components/shared/ErrorFallbackView";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorFallbackView 
      error={error} 
      reset={reset} 
      title="Dashboard Intermission" 
      isDashboard={true} 
    />
  );
}

