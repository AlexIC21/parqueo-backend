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
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )',
    users_id_type
  );
END $$;

ALTER TABLE user_notifications
  DROP CONSTRAINT IF EXISTS user_notifications_user_type_alert_date_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_notifications_daily_first_unique
  ON user_notifications (user_id, type, alert_date)
  WHERE type = 'DAILY_FIRST_CLASS_ALERT';

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_notifications_schedule_class_unique
  ON user_notifications (user_id, type, alert_date, ((data->>'scheduleId')))
  WHERE type = 'SCHEDULE_CLASS_ALERT';

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_created_at
  ON user_notifications (user_id, created_at DESC);

DO $$
DECLARE
  users_id_type TEXT;
  schedules_id_type TEXT;
BEGIN
  SELECT format_type(attribute.atttypid, attribute.atttypmod)
  INTO users_id_type
  FROM pg_attribute attribute
  WHERE attribute.attrelid = 'users'::regclass
    AND attribute.attname = 'id'
    AND NOT attribute.attisdropped;

  SELECT format_type(attribute.atttypid, attribute.atttypmod)
  INTO schedules_id_type
  FROM pg_attribute attribute
  WHERE attribute.attrelid = 'user_schedules'::regclass
    AND attribute.attname = 'id'
    AND NOT attribute.attisdropped;

  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS user_schedule_alert_settings (
      user_id %s NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      schedule_id %s NOT NULL REFERENCES user_schedules(id) ON DELETE CASCADE,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, schedule_id)
    )',
    users_id_type,
    schedules_id_type
  );
END $$;

ALTER TABLE user_schedule_alert_settings
  ALTER COLUMN enabled SET DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_user_schedule_alert_settings_user_enabled
  ON user_schedule_alert_settings (user_id, enabled);

CREATE OR REPLACE FUNCTION enforce_user_schedule_alert_owner()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM user_schedules
    WHERE id = NEW.schedule_id
      AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'schedule_id must belong to user_id';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_schedule_alert_owner
  ON user_schedule_alert_settings;

CREATE TRIGGER trg_user_schedule_alert_owner
BEFORE INSERT OR UPDATE ON user_schedule_alert_settings
FOR EACH ROW
EXECUTE FUNCTION enforce_user_schedule_alert_owner();
