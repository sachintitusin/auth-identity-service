// src/domain/audit/audit.service.ts

import { AuditEventInput } from './audit.types';
import { insertAuditLog } from '../../repos/audit-logs.repo';

export async function emitAuditEvent(
  event: AuditEventInput
): Promise<void> {
  try {
    // Basic defensive checks (cheap, non-fatal)
    if (!event.eventType) return;
    if (!event.actor || !event.actor.type) return;

    // Never allow secrets in metadata (best-effort guard)
    const safeMetadata = sanitizeMetadata(event.metadata);

    await insertAuditLog({
      eventType: event.eventType,
      actorType: event.actor.type,
      actorId: event.actor.id,
      targetType: event.target?.type ?? null,
      targetId: event.target?.id ?? null,
      metadata: safeMetadata,
    });
  } catch {
    // Intentionally swallow all errors
    // Audit must never affect auth behavior
  }
}

function sanitizeMetadata(
  metadata?: Record<string, unknown>
): Record<string, unknown> | null {
  if (!metadata) return null;

  const forbiddenKeys = ['password', 'token', 'refresh_token', 'access_token'];

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (forbiddenKeys.includes(key.toLowerCase())) {
      continue;
    }
    sanitized[key] = value;
  }

  return sanitized;
}
