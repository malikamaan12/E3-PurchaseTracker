import { z } from 'zod';
import { enhanceErrorContext } from './error-analyzer';

export type ErrorSeverity = 'critical' | 'error' | 'warning' | 'info';

export interface ErrorContext {
  message: string;
  severity: ErrorSeverity;
  details?: string | Record<string, unknown>;
  code?: string;
  path?: string;
  timestamp?: Date;
}

export class AppError extends Error {
  public status: number;
  public severity: ErrorSeverity;
  public isOperational: boolean;
  public details?: string | Record<string, unknown>;
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

export class AnthropicError extends AppError {
  constructor(message: string) {
    super(message, 503, 'critical');
    this.code = 'ANTHROPIC_API_ERROR';
  }
}

export async function handleError(err: unknown): Promise<AppError> {
  console.error('Original error:', err);

  let appError: AppError;

  if (err instanceof AppError) {
    appError = err;
  } else if (err instanceof z.ZodError) {
    const details = err.errors.map(e => ({
      path: e.path.join('.'),
      message: e.message
    }));
    appError = new ValidationError('Validation failed', { details });
  } else if (err instanceof Error) {
    console.error('Error stack:', err.stack);
    appError = new AppError(err.message);
    appError.stack = err.stack;
  } else {
    console.error('Unhandled error:', err);
    appError = new AppError('An unexpected error occurred', 500, 'critical');
  }

  // Enhance error with AI analysis
  const enhancedContext = await appError.withAnalysis();
  appError.details = enhancedContext.details;

  return appError;
}