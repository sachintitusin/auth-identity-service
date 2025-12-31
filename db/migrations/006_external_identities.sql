CREATE TABLE external_identities (
  id UUID PRIMARY KEY,
  identity_id UUID NOT NULL,

  provider TEXT NOT NULL,
  provider_subject TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL,

  CONSTRAINT fk_external_identities_identity
    FOREIGN KEY (identity_id)
    REFERENCES identities(id)
    ON DELETE RESTRICT,

  CONSTRAINT uq_external_provider_subject
    UNIQUE (provider, provider_subject)
);
