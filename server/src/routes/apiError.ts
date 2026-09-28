import { NextFunction, Request, Response } from 'express';

/**
 * Client-facing HTTP error. Route handlers throw these (or use the `badRequest`
 * / `notFound` convenience factories) so a single error-handling middleware can
 * translate them into the contract's `{ error: string }` JSON body.
 */
export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** 400 Bad Request error. */
export function badRequest(message: string): ApiError {
  return new ApiError(400, message);
}

/** 404 Not Found error. */
export function notFound(message: string): ApiError {
  return new ApiError(404, message);
}

/** 400 if `value` is not a non-empty string (after trimming). Returns the trimmed string. */
export function requireNonEmptyString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw badRequest(`${name} must be a non-empty string`);
  }
  return value.trim();
}

/** 400 if `value` is present but not a string. Allows empty strings. */
export function requireString(value: unknown, name: string): string {
  if (typeof value !== 'string') {
    throw badRequest(`${name} must be a string`);
  }
  return value;
}

/** 400 unless `value` is a positive integer (number or numeric string). */
export function asId(value: unknown, name: string): number {
  if (typeof value === 'number') {
    if (Number.isInteger(value) && value > 0) return value;
  } else if (typeof value === 'string' && /^\d+$/.test(value)) {
    const n = Number(value);
    if (n > 0) return n;
  }
  throw badRequest(`${name} must be a positive integer`);
}

/** 400 unless `value` is a non-negative integer. */
export function asNonNegativeInt(value: unknown, name: string): number {
  if (typeof value === 'number') {
    if (Number.isInteger(value) && value >= 0) return value;
  } else if (typeof value === 'string' && /^\d+$/.test(value)) {
    return Number(value);
  }
  throw badRequest(`${name} must be a non-negative integer`);
}

/** Parse a path `:id` param to a number, throwing 400 for non-numeric input. */
export function parseIdParam(raw: string | undefined): number {
  if (raw === undefined || raw === '' || !/^\d+$/.test(raw)) {
    throw badRequest('invalid id');
  }
  return Number(raw);
}

/** Coerce `req.body` into a plain object, throwing 400 for missing/non-object bodies. */
export function bodyObject(req: Request): Record<string, unknown> {
  const b = req.body;
  if (b === undefined || b === null || typeof b !== 'object' || Array.isArray(b)) {
    throw badRequest('invalid request body');
  }
  return b as Record<string, unknown>;
}

/**
 * Validation error-handling middleware. Translates `ApiError` instances into the
 * contract's `{ error }` JSON responses (400/404/…). Any other error is
 * forwarded to Express's terminal 500 handler, which logs it.
 */
export function apiErrorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  next(err);
}
