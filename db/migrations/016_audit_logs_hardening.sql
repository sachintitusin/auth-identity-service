-- 016_audit_logs_hardening.sql
-- Purpose:
-- Harden audit_logs by enforcing immutability, adding guardrails,
-- and replacing free-text descriptions with structured metadata.

BEGIN;

-- 1. Replace event_description with structured metadata
ALTER TABLE audit_logs
  DROP COLUMN IF EXISTS event_description,
  ADD COLUMN event_metadata JSONB NULL;

-- 2. Enforce immutability (no UPDATE / DELETE)
CREATE OR REPLACE FUNCTION prevent_audit_logs_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_logs_no_mutation ON audit_logs;

CREATE TRIGGER audit_logs_no_mutation
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_logs_mutation();

-- 3. Guardrails for actor_type
ALTER TABLE audit_logs
  ADD CONSTRAINT chk_audit_logs_actor_type
  CHECK (actor_type IN ('identity', 'service_principal', 'system'));

-- 4. Guardrails for target_type (nullable)
ALTER TABLE audit_logs
  ADD CONSTRAINT chk_audit_logs_target_type
  CHECK (
    target_type IS NULL OR
    target_type IN (
      'identity',
      'credential',
      'session',
      'refresh_token',
      'verification',
      'external_identity',
      'service_principal'
    )
  );

-- 5. Minimal forensic indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON audit_logs (created_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type
  ON audit_logs (event_type);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor
  ON audit_logs (actor_type, actor_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_target
  ON audit_logs (target_type, target_id);

COMMIT;
