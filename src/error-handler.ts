import { Request, Response, NextFunction } from 'express';
import { AppError } from './errors';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  // Known, expected errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.errorCode,
      message: err.message,
    });
  }

  // Unknown / programming errors
  console.error('Unhandled error:', err);

  return res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: 'Something went wrong',
  });
}
