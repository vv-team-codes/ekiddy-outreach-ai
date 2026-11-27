import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';
import { BadRequestError } from '../utils/errors.js';

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(new BadRequestError('Request validation failed', result.error.flatten()));
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      next(new BadRequestError('Query validation failed', result.error.flatten()));
      return;
    }
    req.query = result.data as Request['query'];
    next();
  };
}
