-- 1. Case-insensitive uniqueness for email identifiers
-- Prevents duplicate emails differing only by case
CREATE UNIQUE INDEX uq_identity_identifiers_email_lower
ON identity_identifiers (lower(value))
WHERE type = 'email';


-- 2. Enforce at most one active verification per identity + type
-- Active = not used and not invalidated
CREATE UNIQUE INDEX uq_active_verification_per_identity_type
ON verifications (identity_id, verification_type)
WHERE used_at IS NULL
  AND invalidated_at IS NULL;


-- 3. Prevent ambiguous verification terminal states
-- A verification token cannot be both used and invalidated
ALTER TABLE verifications
ADD CONSTRAINT chk_verification_single_terminal_state
CHECK (
  NOT (used_at IS NOT NULL AND invalidated_at IS NOT NULL)
);
