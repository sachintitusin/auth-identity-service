import { PoolClient } from 'pg';
import { randomUUID } from 'crypto';

import { generateOpaqueToken } from '../security/opaque-token';
import { TOKEN_ENTROPY } from '../security/token-policy';

import {
  findIdentityIdentifier,
  markIdentifierVerified,
  findIdentifierByIdentityAndType,
} from '../repos/identity-identifiers.repo';

import {
  createEmailVerification,
  invalidateActiveVerification,
  findVerificationByHashedToken,
  markVerificationUsed,
} from '../repos/verifications.repo';


export async function initiateEmailVerification(
  client: PoolClient,
  params: {
    email: string;
  }
): Promise<
  | {
      email: string;
      rawToken: string;
      expiresAt: Date;
    }
  | null
> {
    // 1. Resolve identifier silently
    const identifier = await findIdentityIdentifier(client, {
        type: 'email',
        value: params.email,
    });
    // Identity or identifier does not exist → silent no-op
    if (!identifier) {
      return null;
    }
    // Email already verified → nothing to do
    if (identifier.verified_at) {
      return null;
    }
    // 2. Invalidate any existing active verification (idempotent)
    await invalidateActiveVerification(client, {
      identityId: identifier.identity_id,
      verificationType: 'email',
    });
    // 3. Generate new verification token
    const { raw, hash } = generateOpaqueToken(
      TOKEN_ENTROPY.EMAIL_VERIFICATION_BYTES
    );

    const verificationId = randomUUID();

    // Verification expiry (policy decision lives here)
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 hours

    // 4. Persist verification record
    await createEmailVerification(client, {
      verificationId,
      identityId: identifier.identity_id,
      verificationType: 'email',
      hashedToken: hash,
      expiresAt,
    });

    // 5. Return verification intent (caller decides delivery)
    return {
      email: identifier.value,
      rawToken: raw,
      expiresAt,
    };
}

export async function confirmEmailVerification(
  client: PoolClient,
  params: {
    rawToken: string;
  }
): Promise<void> {

  if (!params.rawToken || typeof params.rawToken !== 'string') {
    return;
  }

  // 1. Hash the raw token (raw token is never persisted)
  
  const hashedToken = Buffer.from(
    require('crypto')
      .createHash('sha256')
      .update(params.rawToken)
      .digest()
  );

  // 2. Resolve verification record with row-level lock
  const verification = await findVerificationByHashedToken(
    client,
    hashedToken
  );

  // Unknown token → silent no-op
  if (!verification) {
    return;
  }

  // 3. Validate verification state (all silent)
  const now = new Date();

  if (verification.used_at) {
    return;
  }

  if (verification.invalidated_at) {
    return;
  }

  if (verification.expires_at <= now) {
    return;
  }

  // 4. Mark verification as used (idempotent)
  await markVerificationUsed(client, verification.id);

  // 5. Mark email identifier as verified (idempotent)
  const identifier = await findIdentifierByIdentityAndType(client, {
    identityId: verification.identity_id,
    type: 'email',
  });

  if (!identifier) {
    // Extremely unlikely, but domain must remain safe
    return;
  }

  await markIdentifierVerified(client, identifier.id);
}
