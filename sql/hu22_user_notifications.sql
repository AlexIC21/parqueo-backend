DO $$
DECLARE
  users_id_type TEXT;
BEGIN
  SELECT format_type(attribute.atttypid, attribute.atttypmod)
  INTO users_id_type
  FROM pg_attribute attribute
  WHERE attribute.attrelid = 'users'::regclass
    AND attribute.attname = 'id'
    AND NOT attribute.attisdropped;

  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS user_notifications (
      id BIGSERIAL PRIMARY KEY,
      user_id %s NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(80) NOT NULL,
      title VARCHAR(160) NOT NULL,
      message TEXT NOT NULL,
      data JSONB NOT NULL DEFAULT ''{}''::jsonb,
      alert_date DATE NOT NULL,
      scheduled_for TIMESTAMP NOT NULL,
      delivered_at TIMESTAMP NULL,
      read_at TIMESTAMP NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      CONSTRAINT user_notifications_user_type_alert_date_unique
        UNIQUE (user_id, type, alert_date)
    )',
    users_id_type
  );
END $$;

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_created_at
  ON user_notifications (user_id, created_at DESC);
