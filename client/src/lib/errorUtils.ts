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

const severityDurations = {
  critical: 10000, // 10 seconds
  error: 7000,     // 7 seconds
  warning: 5000,   // 5 seconds
  info: 3000       // 3 seconds
} as const;

export function visualizeError(context: ErrorContext): void {
  const { message, severity, details, code } = context;

  // Log to console for debugging
  console.error(`[${severity.toUpperCase()}] ${message}`, {
    details,
    code,
    timestamp: new Date().toISOString()
  });

  // Format details if they exist
  let detailsMessage = '';
  if (details) {
    if (typeof details === 'string') {
      detailsMessage = details;
    } else if (Array.isArray(details)) {
      detailsMessage = details.map(d => 
        typeof d === 'string' ? d : JSON.stringify(d)
      ).join('\n');
    } else if (typeof details === 'object') {
      detailsMessage = Object.entries(details)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');
    }
  }

  // Show toast notification with appropriate styling
  toast({
    title: `${severityIcons[severity]} ${code || severity.toUpperCase()}`,
    description: detailsMessage ? `${message}\n${detailsMessage}` : message,
    variant: severity === 'critical' ? 'destructive' : 'default',
    className: `${severityColors[severity]} border-l-4`,
    duration: severityDurations[severity],
  });
}

export function determineSeverity(error: unknown): ErrorSeverity {
  if (error instanceof Error) {
    // Network errors are critical
    if (error.message.includes('Failed to fetch') || 
        error.message.includes('Network Error')) {
      return 'critical';
    }
    // Authentication errors are errors
    if (error.message.toLowerCase().includes('unauthorized') || 
        error.message.toLowerCase().includes('forbidden')) {
      return 'error';
    }
    // Validation errors are warnings
    if (error.message.toLowerCase().includes('validation') || 
        error.message.toLowerCase().includes('required')) {
      return 'warning';
    }
  }
  // Default to error for unknown cases
  return 'error';
}

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

export async function handleApiError(response: Response): Promise<never> {
  let errorData;
  try {
    errorData = await response.json();
  } catch {
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  const error = new Error(errorData.message || 'API Error');
  (error as any).status = response.status;
  (error as any).code = errorData.code;
  (error as any).details = errorData.details;
  throw error;
}

export async function analyzeFormError(formData: any, error: any): Promise<string> {
  try {
    console.error("Form submission error:", {
      formData,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack
      } : error
    });

    const issues: string[] = [];

    // Check for common form issues
    if (!formData) {
      issues.push("Form data is missing");
    }

    if (error instanceof Error) {
      if (error.message.includes("required")) {
        issues.push("Required fields are missing");
      }
      if (error.message.includes("type")) {
        issues.push("Invalid data type in form fields");
      }
      if (error.message.includes("format")) {
        issues.push("Data format is incorrect");
      }
    }

    // If no specific issues found, provide generic guidance
    if (issues.length === 0) {
      issues.push(
        "Please check all required fields are filled",
        "Ensure data formats are correct",
        "Verify field values meet validation rules"
      );
    }

    return issues.join("\n");
  } catch (analyzeError) {
    console.error("Error analysis failed:", analyzeError);
    return "Unable to analyze the error. Please check the form inputs and try again.";
  }
}