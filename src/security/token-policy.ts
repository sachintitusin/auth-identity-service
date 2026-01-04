/**
 * Centralized entropy policy for opaque secrets.
 *
 * These values define the minimum entropy for security-sensitive tokens.
 * Changing them here updates the entire system consistently.
 */
export const TOKEN_ENTROPY = {
  EMAIL_VERIFICATION_BYTES: 32,
  REFRESH_TOKEN_BYTES: 32,
  PASSWORD_RESET_BYTES: 32,
} as const;
