// src/repos/audit-logs.repo.ts

import { pool } from '../db';
import { AuditEventType } from '../domain/audit/audit.types';

type InsertAuditLogParams = {
  eventType: AuditEventType;
  actorType: string;
  actorId: string | null;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
};

export async function insertAuditLog(
  params: InsertAuditLogParams
): Promise<void> {
  const {
    eventType,
    actorType,
    actorId,
    targetType,
    targetId,
    metadata,
  } = params;

  await pool.query(
    `
    INSERT INTO audit_logs (
      id,
      event_type,
      actor_type,
      actor_id,
      target_type,
      target_id,
      event_metadata,
      created_at
    )
    VALUES (
      gen_random_uuid(),
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      now()
    )
    `,
    [
      eventType,
      actorType,
      actorId,
      targetType,
      targetId,
      metadata,
    ]
  );
}
