CREATE TABLE password_credentials (
  credential_id UUID PRIMARY KEY
    REFERENCES credentials(id) ON DELETE CASCADE,

  identifier_id UUID NOT NULL
    REFERENCES identity_identifiers(id) ON DELETE CASCADE,

  password_hash TEXT NOT NULL,
  hash_algorithm TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);