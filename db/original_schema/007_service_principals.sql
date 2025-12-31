CREATE TABLE service_principals (
  id UUID PRIMARY KEY,

  public_identifier UUID NOT NULL UNIQUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);
