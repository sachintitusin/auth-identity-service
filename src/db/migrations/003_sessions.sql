CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  identity_id UUID NOT NULL,

  -- Public, stable identifier safe to expose to frontend/tokens
  session_identifier UUID NOT NULL UNIQUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  terminated_at TIMESTAMPTZ NULL,
  termination_reason TEXT NULL,

  CONSTRAINT fk_sessions_identity
    FOREIGN KEY (identity_id)
    REFERENCES identities(id)
    ON DELETE RESTRICT
);
