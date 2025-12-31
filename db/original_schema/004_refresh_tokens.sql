CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL,

  -- Hash of the raw refresh token (raw token is never stored)
  hashed_token BYTEA NOT NULL UNIQUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ NULL,
  revoked_at TIMESTAMPTZ NULL,

  CONSTRAINT fk_refresh_tokens_session
    FOREIGN KEY (session_id)
    REFERENCES sessions(id)
    ON DELETE RESTRICT
);
