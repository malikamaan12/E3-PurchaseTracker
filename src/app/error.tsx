"use client";

import { ErrorFallbackView } from "@/components/shared/ErrorFallbackView";

export default function ErrorBoundary({
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
      title="Application Rest Stop" 
      isDashboard={false} 
    />
  );
}

