import { z } from 'zod';
import { passwordSchema } from './password.schema';

export const registerSchema = z.object({
  email: z.string().email().max(320),
  password: passwordSchema,
});
