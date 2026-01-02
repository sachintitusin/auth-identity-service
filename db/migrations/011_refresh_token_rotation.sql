-- Enable refresh token rotation lineage

ALTER TABLE refresh_tokens
ADD COLUMN replaced_by_token_id UUID NULL;

ALTER TABLE refresh_tokens
ADD CONSTRAINT fk_refresh_tokens_replaced_by
  FOREIGN KEY (replaced_by_token_id)
  REFERENCES refresh_tokens(id)
  ON DELETE SET NULL;


-- Observational field for session token issuance
-- Must never be used for authorization decisions

ALTER TABLE sessions
ADD COLUMN last_token_issued_at TIMESTAMPTZ NULL;


-- Indexes to support fast validation and attack resistance

CREATE INDEX idx_refresh_tokens_session_id
  ON refresh_tokens(session_id);

CREATE INDEX idx_refresh_tokens_valid
  ON refresh_tokens(hashed_token)
  WHERE used_at IS NULL AND revoked_at IS NULL;
