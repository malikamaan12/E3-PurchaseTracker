export class AppError extends Error {
  public status: number;
  public isOperational: boolean;

  constructor(message: string, status: number = 500) {
    super(message);
    this.status = status;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Not authenticated') {
    super(message, 401);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Not authorized') {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
  }
}

export function handleError(err: any): AppError {
  if (err instanceof AppError) {
    return err;
  }

  // Database errors
  if (err.code === '23505') { // Unique violation
    return new ValidationError('A record with this value already exists');
  }
  if (err.code === '23503') { // Foreign key violation
    return new ValidationError('Referenced record does not exist');
  }

  // Handle other known error types
  if (err.name === 'ZodError') {
    return new ValidationError(err.errors[0].message);
  }

  // Default error
  console.error('Unhandled error:', err);
  return new AppError('An unexpected error occurred');
}
