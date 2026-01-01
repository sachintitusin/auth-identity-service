import { ZodSchema } from 'zod';
import { BadRequestError } from '../errors';
import { Request, Response, NextFunction } from 'express';

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);

    if (!parsed.success) {
      throw new BadRequestError('INVALID_REQUEST_BODY');
    }

    req.body = parsed.data;
    next();
  };
}
