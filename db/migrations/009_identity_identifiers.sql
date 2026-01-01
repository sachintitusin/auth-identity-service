CREATE TABLE identity_identifiers (
  id UUID PRIMARY KEY,
  identity_id UUID NOT NULL
    REFERENCES identities(id) ON DELETE CASCADE,

  type TEXT NOT NULL,          -- 'email', 'phone', etc.
  value TEXT NOT NULL,

  verified_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_identifier_type_value UNIQUE (type, value)
);
