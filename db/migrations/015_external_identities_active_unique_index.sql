-- External identities support soft deletion via deleted_at.
-- A plain UNIQUE constraint on (provider, provider_subject)
-- prevents re-linking after unlink and contradicts the lifecycle model.
--
-- This migration replaces the UNIQUE constraint with a partial unique index
-- enforcing uniqueness only for active (non-deleted) external identities.

BEGIN;

-- 1. Drop the existing UNIQUE constraint
ALTER TABLE external_identities
DROP CONSTRAINT IF EXISTS uq_external_provider_subject;

-- 2. Add partial unique index for active external identities
CREATE UNIQUE INDEX uq_active_external_provider_subject
ON external_identities (provider, provider_subject)
WHERE deleted_at IS NULL;

COMMIT;
