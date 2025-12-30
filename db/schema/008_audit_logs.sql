CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,

  -- What happened
  event_type TEXT NOT NULL,
  event_description TEXT NULL,

  -- Who / what triggered the event
  actor_type TEXT NOT NULL,          -- identity | service_principal | system
  actor_id UUID NULL,                -- references id of actor (no FK)

  -- What the event was about
  target_type TEXT NULL,             -- identity | credential | session | refresh_token | verification | external_identity | service_principal
  target_id UUID NULL,               -- referenced entity id (no FK)

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
