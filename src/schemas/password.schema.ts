import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(12)
  .max(128)
  .refine((v) => /[a-zA-Z]/.test(v))
  .refine((v) => /[\d\W]/.test(v));
