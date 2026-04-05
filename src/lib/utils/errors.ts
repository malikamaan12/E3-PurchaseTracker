import { z } from 'zod';
import { enhanceErrorContext } from './error-analyzer';
import { enhanceErrorWithPredictions } from './error-predictor';

export type ErrorSeverity = 'critical' | 'error' | 'warning' | 'info';

export interface ErrorContext {
  message: string;
  severity: ErrorSeverity;
  details?: Record<string, unknown>;
  code?: string;
  path?: string;
  timestamp?: Date;
  predictions?: string[];
  suggestions?: string[];
}

export class AppError extends Error {
  public status: number;
  public severity: ErrorSeverity;
  public isOperational: boolean;
  public details?: Record<string, unknown>;
  public code?: string;
  public timestamp: Date;
  public predictions?: string[];
  public suggestions?: string[];

  constructor(message: string, status: number = 500, severity: ErrorSeverity = 'error') {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.severity = severity;
    this.isOperational = true;
    this.timestamp = new Date();
    Error.captureStackTrace(this, this.constructor);
  }

  public toJSON(): ErrorContext {
    return {
      message: this.message,
      severity: this.severity,
      details: this.details,
      code: this.code,
      timestamp: this.timestamp,
      predictions: this.predictions,
      suggestions: this.suggestions
    };
  }

  public async withAnalysis(context: string = 'application'): Promise<ErrorContext> {
    try {
      // First do the standard analysis
      const enhancedContext = await enhanceErrorContext(this);

      // Then add the AI-powered predictions and suggestions
      const { error: enhancedError, predictions, suggestions } = 
        await enhanceErrorWithPredictions(this, context);

      // Merge both enhancements
      this.details = {
        ...this.details,
        aiAnalysis: enhancedContext.details,
      };

      this.predictions = predictions;
      this.suggestions = suggestions;

      return this.toJSON();
    } catch (analysisError) {
      console.error('Error analysis failed:', analysisError);
      return this.toJSON();
    }
  }

  public static ensureError(err: unknown): AppError {
    if (err instanceof AppError) {
      return err;
    }

    if (err instanceof z.ZodError) {
      const error = new ValidationError('Validation failed');
      error.details = {
        errors: err.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message
        }))
      };
      return error;
    }

    if (err instanceof Error) {
      const error = new AppError(err.message);
      error.stack = err.stack;
      return error;
    }

    return new AppError(String(err));
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 400, 'warning');
    this.details = details;
    this.code = 'VALIDATION_ERROR';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Not authenticated') {
    super(message, 401, 'error');
    this.code = 'AUTHENTICATION_ERROR';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Not authorized') {
    super(message, 403, 'error');
    this.code = 'AUTHORIZATION_ERROR';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'warning');
    this.code = 'NOT_FOUND_ERROR';
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = 'Database operation failed') {
    super(message, 500, 'critical');
    this.code = 'DATABASE_ERROR';
  }
}

export async function handleError(err: unknown): Promise<AppError> {
  const error = AppError.ensureError(err);

  console.error('Error details:', {
    name: error.name,
    message: error.message,
    status: error.status,
    severity: error.severity,
    code: error.code,
    timestamp: error.timestamp,
    stack: error.stack
  });

  // Enhance error with AI analysis and predictions
  if (error.status >= 400) {
    try {
      const context = error.code ? error.code.toLowerCase() : 'application';
      await error.withAnalysis(context);
    } catch (analysisError) {
      console.error('Failed to enhance error with AI analysis:', analysisError);
    }
  }

  return error;
}