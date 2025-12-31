CREATE TABLE IF NOT EXISTS schema_migrations (
  filename TEXT PRIMARY KEY,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
