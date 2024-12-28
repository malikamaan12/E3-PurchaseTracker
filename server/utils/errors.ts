import { z } from 'zod';
import { enhanceErrorContext } from './error-analyzer';

export type ErrorSeverity = 'critical' | 'error' | 'warning' | 'info';

export interface ErrorContext {
  message: string;
  severity: ErrorSeverity;
  details?: unknown;
  code?: string;
  path?: string;
  timestamp?: Date;
}

export class AppError extends Error {
  public status: number;
  public severity: ErrorSeverity;
  public isOperational: boolean;
  public details?: unknown;
  public code?: string;
  public timestamp: Date;

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
      timestamp: this.timestamp
    };
  }

  public async withAnalysis(): Promise<ErrorContext> {
    return enhanceErrorContext(this);
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
  constructor(message: string, details?: unknown) {
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

export class SessionError extends AppError {
  constructor(message: string = 'Session error occurred') {
    super(message, 500, 'error');
    this.code = 'SESSION_ERROR';
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

  // Enhance error with AI analysis for 500-level errors
  if (error.status >= 500) {
    try {
      const enhancedContext = await error.withAnalysis();
      error.details = enhancedContext.details;
    } catch (analysisError) {
      console.error('Failed to enhance error with AI analysis:', analysisError);
    }
  }

  return error;
}