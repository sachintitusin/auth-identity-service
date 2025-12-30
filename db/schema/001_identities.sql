CREATE TABLE identities (
  id UUID PRIMARY KEY,
  subject_id UUID NOT NULL UNIQUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);
