import { z } from 'zod';
import { passwordSchema } from './password.schema';

export const changePasswordSchema = z.object({
  current_password: passwordSchema,
  new_password: passwordSchema,
});
