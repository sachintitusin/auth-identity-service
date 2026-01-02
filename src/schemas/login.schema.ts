import { z } from 'zod';
import { passwordSchema } from './password.schema';

export const loginSchema = z.object({
  email: z
    .string()
    .email()
    .max(320),

  password: passwordSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
