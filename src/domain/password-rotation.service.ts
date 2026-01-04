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

/**
 * Rotate (change) password for an identity (subject-based).
 *
 * Security semantics:
 * - JWT subject is resolved to internal identity_id
 * - All failures collapse to AUTHENTICATION_FAILED
 * - Credential rotation + global session revocation is mandatory
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

  // ---- Step 0: Resolve subject → internal identity_id ----
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

  // ---- Step 3: Verify current password (CPU-bound) ----
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

  // ---- Step 5: Invalidate all sessions + refresh tokens ----
  await revokeAllSessionsForIdentity(
    client,
    identityId,
    SessionTerminationReason.PASSWORD_CHANGE
  );
}
