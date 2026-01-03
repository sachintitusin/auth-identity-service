-- Enforce at most one active refresh token per session
-- Active = not used and not revoked
--
-- This is a defense-in-depth constraint to preserve
-- INV-TOKEN-2 (single-use refresh tokens) and
-- prevent accidental invariant violations in future changes.

CREATE UNIQUE INDEX IF NOT EXISTS
  uniq_active_refresh_token_per_session
ON refresh_tokens (session_id)
WHERE used_at IS NULL
  AND revoked_at IS NULL;
