import { toast } from "@/hooks/use-toast";

export type ErrorSeverity = 'critical' | 'error' | 'warning' | 'info';

interface ErrorContext {
  message: string;
  severity: ErrorSeverity;
  details?: string | Record<string, unknown>;
  code?: string;
  path?: string;
  timestamp?: Date;
}

const severityColors = {
  critical: 'bg-red-100 border-red-500 text-red-900',
  error: 'bg-orange-100 border-orange-500 text-orange-900',
  warning: 'bg-yellow-100 border-yellow-500 text-yellow-800',
  info: 'bg-blue-100 border-blue-500 text-blue-900'
} as const;

const severityIcons = {
  critical: '🔥',
  error: '⚠️',
  warning: '⚡',
  info: 'ℹ️'
} as const;

export function visualizeError(context: ErrorContext): void {
  const { message, severity, details, code, path } = context;
  
  // Log to console for debugging
  console.error(`[${severity.toUpperCase()}] ${message}`, {
    details,
    code,
    path,
    timestamp: new Date().toISOString()
  });

  // Show toast notification with appropriate styling
  toast({
    title: `${severityIcons[severity]} ${severity.toUpperCase()}`,
    description: message,
    variant: severity === 'critical' ? 'destructive' : 'default',
    className: `${severityColors[severity]} border-l-4`,
    duration: severity === 'critical' ? 10000 : 5000, // Show critical errors longer
  });
}

// Helper function to determine severity based on error type
export function determineSeverity(error: unknown): ErrorSeverity {
  if (error instanceof Error) {
    // Network errors are critical
    if (error.message.includes('Failed to fetch') || error.message.includes('Network Error')) {
      return 'critical';
    }
    // Authentication errors are errors
    if (error.message.includes('unauthorized') || error.message.includes('forbidden')) {
      return 'error';
    }
    // Validation errors are warnings
    if (error.message.includes('validation') || error.message.includes('required')) {
      return 'warning';
    }
  }
  // Default to error for unknown cases
  return 'error';
}

// Utility function to create error context
export function createErrorContext(
  error: unknown,
  severity?: ErrorSeverity,
  additionalContext?: Partial<ErrorContext>
): ErrorContext {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const determinedSeverity = severity || determineSeverity(error);
  
  return {
    message: errorMessage,
    severity: determinedSeverity,
    details: error instanceof Error ? error.stack : undefined,
    timestamp: new Date(),
    ...additionalContext
  };
}
