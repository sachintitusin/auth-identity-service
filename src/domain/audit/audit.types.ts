// src/domain/audit/audit.types.ts

export enum AuditEventType {
  // Identity
  IDENTITY_CREATED = 'IDENTITY_CREATED',
  EMAIL_VERIFIED = 'EMAIL_VERIFIED',

  // Credentials
  PASSWORD_CREDENTIAL_ROTATED = 'PASSWORD_CREDENTIAL_ROTATED',

  // Sessions
  SESSION_CREATED = 'SESSION_CREATED',
  SESSION_TERMINATED = 'SESSION_TERMINATED',

  // Refresh tokens
  REFRESH_TOKEN_ISSUED = 'REFRESH_TOKEN_ISSUED',
  REFRESH_TOKEN_ROTATED = 'REFRESH_TOKEN_ROTATED',
  REFRESH_TOKEN_REUSE_DETECTED = 'REFRESH_TOKEN_REUSE_DETECTED',

  // Verification
  VERIFICATION_TOKEN_ISSUED = 'VERIFICATION_TOKEN_ISSUED',
  VERIFICATION_TOKEN_INVALIDATED = 'VERIFICATION_TOKEN_INVALIDATED',

  // OAuth / external identity
  EXTERNAL_IDENTITY_CREATED = 'EXTERNAL_IDENTITY_CREATED',
  OAUTH_LOGIN_SUCCESS = 'OAUTH_LOGIN_SUCCESS',
}


export type AuditActorType =
  | 'identity'
  | 'external_identity'
  | 'service_principal'
  | 'system';

export type AuditTargetType =
  | 'identity'
  | 'credential'
  | 'session'
  | 'refresh_token'
  | 'verification'
  | 'external_identity';


export interface AuditEventInput {
  eventType: AuditEventType;

  actor: {
    type: AuditActorType;
    id: string | null;
  };

  target?: {
    type: AuditTargetType;
    id: string;
  };

  metadata?: Record<string, unknown>;
}
