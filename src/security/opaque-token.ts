import { randomBytes, createHash } from 'crypto';

/**
 * Generate an opaque secret and its SHA-256 hash.
 *
 * - The raw value is returned once to be delivered to the client.
 * - Only the hash must be persisted.
 */
export function generateOpaqueToken(
  byteLength: number
): { raw: string; hash: Buffer } {
  const raw = randomBytes(byteLength).toString('base64url');
  const hash = createHash('sha256').update(raw).digest();
  return { raw, hash };
}
