CREATE TABLE verifications (
  id UUID PRIMARY KEY,
  identity_id UUID NOT NULL,

  verification_type TEXT NOT NULL,

  -- Hash of the raw verification token (raw token is never stored)
  hashed_token BYTEA NOT NULL UNIQUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ NULL,
  invalidated_at TIMESTAMPTZ NULL,

  CONSTRAINT fk_verifications_identity
    FOREIGN KEY (identity_id)
    REFERENCES identities(id)
    ON DELETE RESTRICT
);
