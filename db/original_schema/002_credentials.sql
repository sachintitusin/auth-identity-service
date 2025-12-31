CREATE TABLE credentials (
  id UUID PRIMARY KEY,
  identity_id UUID NOT NULL,

  credential_type TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ NULL,

  CONSTRAINT fk_credentials_identity
    FOREIGN KEY (identity_id)
    REFERENCES identities(id)
    ON DELETE RESTRICT,

  CONSTRAINT uq_identity_credential_type
    UNIQUE (identity_id, credential_type)
);