export const SessionTerminationReason = {
  USER_LOGOUT: 'USER_LOGOUT',
  TOKEN_REUSE: 'TOKEN_REUSE',
  PASSWORD_CHANGE: 'PASSWORD_CHANGE',
  ADMIN_REVOCATION: 'ADMIN_REVOCATION',
} as const;

export type SessionTerminationReason =
  typeof SessionTerminationReason[keyof typeof SessionTerminationReason];
