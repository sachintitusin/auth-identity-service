import { PoolClient } from 'pg';
import bcrypt from 'bcrypt';

import {
  findActivePasswordCredential,
  revokeCredential,
  createPasswordCredential,
} from '../repos/credentials.repo';

import {
  findPasswordCredentialSecret,
  createPasswordCredentialSecret,
} from '../repos/password-credentials.repo';

import { revokeAllSessionsForIdentity } from '../repos/refresh-tokens.repo';
import { AuthenticationFailedError } from '../errors';
import { SessionTerminationReason } from './session-termination-reason';

import { emitAuditEvent } from './audit/audit.service';
import { AuditEventType } from './audit/audit.types';

/**
 * Rotate (change) password for an identity (subject-based).
 *
 * Security semantics:
 * - Subject resolves to internal identity_id
 * - All failures collapse to AuthenticationFailedError
 * - Credential rotation + global session revocation is mandatory
 * - Audit is emitted ONLY on full success
 *
 * Must be executed inside an existing transaction.
 */
export async function rotatePasswordForSubject(
  client: PoolClient,
  params: {
    identitySubject: string;
    currentPassword: string;
    newPassword: string;
  }
): Promise<void> {
  const { identitySubject, currentPassword, newPassword } = params;

  // ---- Step 0: Resolve subject → identity_id ----
  const identityRes = await client.query(
    `
    SELECT id
    FROM identities
    WHERE subject_id = $1
      AND deleted_at IS NULL
    `,
    [identitySubject]
  );

  if (identityRes.rowCount === 0) {
    throw new AuthenticationFailedError();
  }

  const identityId = identityRes.rows[0].id;

  // ---- Step 1: Resolve active password credential ----
  const activeCredential = await findActivePasswordCredential(
    client,
    identityId
  );

  if (!activeCredential) {
    throw new AuthenticationFailedError();
  }

  // ---- Step 2: Load password secret ----
  const secret = await findPasswordCredentialSecret(
    client,
    activeCredential.id
  );

  if (!secret) {
    // Fail closed — inconsistent state
    throw new AuthenticationFailedError();
  }

  // ---- Step 3: Verify current password ----
  const passwordMatches = await bcrypt.compare(
    currentPassword,
    secret.passwordHash
  );

  if (!passwordMatches) {
    throw new AuthenticationFailedError();
  }

  // ---- Step 4: Rotate credential ----
  await revokeCredential(client, activeCredential.id);

  const { credentialId: newCredentialId } =
    await createPasswordCredential(client, identityId);

  const newPasswordHash = await bcrypt.hash(newPassword, 12);

  await createPasswordCredentialSecret(client, {
    credentialId: newCredentialId,
    identifierId: secret.identifierId,
    passwordHash: newPasswordHash,
    hashAlgorithm: 'bcrypt',
  });

  // ---- Step 5: Revoke all sessions ----
  await revokeAllSessionsForIdentity(
    client,
    identityId,
    SessionTerminationReason.PASSWORD_CHANGE
  );

  // ---- Step 6: Emit audit event (SUCCESS ONLY) ----
  await emitAuditEvent({
    eventType: AuditEventType.PASSWORD_CREDENTIAL_ROTATED,
    actor: {
      type: 'identity',
      id: identityId,
    },
    target: {
      type: 'identity',
      id: identityId,
    },
    metadata: {
      session_revocation: 'all',
      rotation_reason: 'user_initiated',
    },
  });
}
