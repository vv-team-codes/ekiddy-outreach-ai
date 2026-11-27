import type { Response } from 'express';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR', details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'BAD_REQUEST', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

export class InsufficientCreditsError extends AppError {
  constructor(required: number, available: number) {
    super(
      `Insufficient credits: operation requires ${required} credits, available balance is ${available}`,
      402,
      'INSUFFICIENT_CREDITS',
      { required, available }
    );
  }
}

export function ok<T>(res: Response, data: T, meta?: Record<string, unknown>, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
    ...(meta ? { meta } : {})
  });
}
