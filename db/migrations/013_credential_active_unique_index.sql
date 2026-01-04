-- safety check to avoid migration attempts when data is inconsistent
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM credentials
    WHERE revoked_at IS NULL
    GROUP BY identity_id, credential_type
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Migration aborted: multiple active credentials exist for the same identity and type';
  END IF;
END $$;


-- Drop the existing global unique constraint
ALTER TABLE credentials
DROP CONSTRAINT uq_identity_credential_type;

-- Enforce at most one ACTIVE credential per identity + type
CREATE UNIQUE INDEX uniq_active_credential_per_identity
ON credentials (identity_id, credential_type)
WHERE revoked_at IS NULL;
