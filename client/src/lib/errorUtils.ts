import { toast } from "@/hooks/use-toast";

export type ErrorSeverity = 'critical' | 'error' | 'warning' | 'info';

interface ErrorAnalysis {
  prediction?: string;
  suggestions?: string[];
  preventiveMeasures?: string[];
}

interface ErrorContext {
  message: string;
  severity: ErrorSeverity;
  details?: string | Record<string, unknown>;
  code?: string;
  path?: string;
  timestamp?: Date;
  analysis?: ErrorAnalysis;
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

const severityAnimations = {
  critical: 'error-bounce-in error-critical',
  error: 'error-shake',
  warning: 'error-fade-slide error-warning',
  info: 'error-fade-slide error-info'
} as const;

const severityDurations = {
  critical: 10000, // 10 seconds
  error: 7000,     // 7 seconds
  warning: 5000,   // 5 seconds
  info: 3000       // 3 seconds
} as const;

export function visualizeError(context: ErrorContext): void {
  const { message, severity, details, code, analysis } = context;

  // Log to console for debugging
  console.error(`[${severity.toUpperCase()}] ${message}`, {
    details,
    code,
    analysis,
    timestamp: new Date().toISOString()
  });

  // Format error message with AI analysis if available
  let description = message;

  if (analysis) {
    if (analysis.prediction) {
      description += `\n\nProbable Cause: ${analysis.prediction}`;
    }

    if (analysis.suggestions?.length) {
      description += '\n\nSuggestions:';
      analysis.suggestions.forEach(suggestion => {
        description += `\n• ${suggestion}`;
      });
    }

    if (analysis.preventiveMeasures?.length) {
      description += '\n\nPreventive Measures:';
      analysis.preventiveMeasures.forEach(measure => {
        description += `\n• ${measure}`;
      });
    }
  }

  // Show toast notification with appropriate styling and animation
  toast({
    title: `${severityIcons[severity]} ${code || severity.toUpperCase()}`,
    description,
    variant: severity === 'critical' ? 'destructive' : 'default',
    className: `${severityColors[severity]} ${severityAnimations[severity]} border-l-4 whitespace-pre-wrap`,
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
  return 'error';
}

export function createErrorContext(
  error: unknown,
  severity?: ErrorSeverity,
  additionalContext?: Partial<ErrorContext>
): ErrorContext {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const determinedSeverity = severity || determineSeverity(error);

  // Extract analysis from error if available
  const analysis = error instanceof Error && (error as any).details?.analysis 
    ? (error as any).details.analysis as ErrorAnalysis
    : undefined;

  return {
    message: errorMessage,
    severity: determinedSeverity,
    details: error instanceof Error ? error.stack : undefined,
    timestamp: new Date(),
    analysis,
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
        stack: error.stack,
        analysis: (error as any).details?.analysis
      } : error
    });

    // If we have AI analysis, use it
    if (error instanceof Error && (error as any).details?.analysis) {
      const analysis = (error as any).details.analysis as ErrorAnalysis;
      const suggestions = [
        ...(analysis.suggestions || []),
        ...(analysis.preventiveMeasures || [])
      ];
      return suggestions.join("\n");
    }

    // Fallback to basic analysis
    const issues: string[] = [];
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