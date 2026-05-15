import {
  ForbiddenException,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  SelectedScheduleAlertDto,
  UpdateAlertPreferencesDto,
} from './dto/update-alert-preferences.dto';

interface AlertPreferencesRow {
  user_id: number;
  enabled: boolean;
  minutes_before: number;
  vehicle_type: 'AUTO' | 'MOTO';
  only_first_class_per_day: boolean;
}

interface ScheduleAlertSettingRow {
  schedule_id: number;
  enabled: boolean;
}

@Injectable()
export class AlertPreferencesService implements OnModuleInit {
  private readonly defaultPreferences = {
    enabled: true,
    minutesBefore: 30,
    vehicleType: 'AUTO' as const,
    onlyFirstClassPerDay: false,
  };

  constructor(private readonly databaseService: DatabaseService) {}

  async onModuleInit() {
    await this.ensureScheduleAlertSettingsTable();
  }

  async getMyAlertPreferences(userId: number) {
    const [preferencesResult, selectedScheduleAlerts] = await Promise.all([
      this.databaseService.query<AlertPreferencesRow>(
        `
        SELECT
          user_id,
          enabled,
          minutes_before,
          vehicle_type,
          only_first_class_per_day
        FROM user_alert_preferences
        WHERE user_id = $1
        LIMIT 1;
      `,
        [userId],
      ),
      this.getSelectedScheduleAlerts(userId),
    ]);

    const row = preferencesResult.rows[0];

    if (!row) {
      return {
        ...this.defaultPreferences,
        selectedScheduleAlerts,
      };
    }

    return {
      ...this.mapAlertPreferences(row),
      selectedScheduleAlerts,
    };
  }

  async upsertMyAlertPreferences(
    userId: number,
    dto: UpdateAlertPreferencesDto,
  ) {
    const minutesBefore =
      dto.minutesBefore ?? this.defaultPreferences.minutesBefore;

    if (dto.selectedScheduleAlerts !== undefined) {
      await this.assertScheduleOwnership(
        userId,
        dto.selectedScheduleAlerts.map((item) => item.scheduleId),
      );
    }

    const result = await this.databaseService.query<AlertPreferencesRow>(
      `
      INSERT INTO user_alert_preferences (
        user_id,
        enabled,
        minutes_before,
        vehicle_type,
        only_first_class_per_day,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        enabled = EXCLUDED.enabled,
        minutes_before = EXCLUDED.minutes_before,
        vehicle_type = EXCLUDED.vehicle_type,
        only_first_class_per_day = EXCLUDED.only_first_class_per_day,
        updated_at = NOW()
      RETURNING
        user_id,
        enabled,
        minutes_before,
        vehicle_type,
        only_first_class_per_day;
    `,
      [
        userId,
        dto.enabled,
        minutesBefore,
        dto.vehicleType,
        false,
      ],
    );

    if (dto.selectedScheduleAlerts !== undefined) {
      await this.replaceSelectedScheduleAlerts(
        userId,
        dto.selectedScheduleAlerts,
      );
    }

    return {
      ...this.mapAlertPreferences(result.rows[0]),
      selectedScheduleAlerts: await this.getSelectedScheduleAlerts(userId),
    };
  }

  private async ensureScheduleAlertSettingsTable() {
    await this.databaseService.query(`
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
    `);
  }

  private async getSelectedScheduleAlerts(userId: number) {
    const result =
      await this.databaseService.query<ScheduleAlertSettingRow>(
        `
        SELECT
          schedule_id,
          enabled
        FROM user_schedule_alert_settings
        WHERE user_id = $1
        ORDER BY schedule_id ASC;
      `,
        [userId],
      );

    return result.rows.map((row) => ({
      scheduleId: Number(row.schedule_id),
      enabled: row.enabled,
    }));
  }

  private async assertScheduleOwnership(userId: number, scheduleIds: number[]) {
    const uniqueScheduleIds = [...new Set(scheduleIds)];

    if (uniqueScheduleIds.length === 0) {
      return;
    }

    const result = await this.databaseService.query<{ id: number }>(
      `
      SELECT id
      FROM user_schedules
      WHERE user_id = $1
        AND id = ANY($2::bigint[]);
    `,
      [userId, uniqueScheduleIds],
    );

    if (result.rows.length !== uniqueScheduleIds.length) {
      throw new ForbiddenException({
        success: false,
        message: 'No se permite configurar horarios de otro usuario',
      });
    }
  }

  private async replaceSelectedScheduleAlerts(
    userId: number,
    selectedScheduleAlerts: SelectedScheduleAlertDto[],
  ) {
    const normalized = [
      ...new Map(
        selectedScheduleAlerts.map((item) => [item.scheduleId, item]),
      ).values(),
    ];

    await this.databaseService.query(
      `
      DELETE FROM user_schedule_alert_settings
      WHERE user_id = $1;
    `,
      [userId],
    );

    if (normalized.length === 0) {
      return;
    }

    await this.databaseService.query(
      `
      INSERT INTO user_schedule_alert_settings (
        user_id,
        schedule_id,
        enabled,
        created_at,
        updated_at
      )
      SELECT
        $1,
        item.schedule_id,
        item.enabled,
        NOW(),
        NOW()
      FROM jsonb_to_recordset($2::jsonb) AS item(
        schedule_id bigint,
        enabled boolean
      )
      ON CONFLICT (user_id, schedule_id)
      DO UPDATE SET
        enabled = EXCLUDED.enabled,
        updated_at = NOW();
    `,
      [
        userId,
        JSON.stringify(
          normalized.map((item) => ({
            schedule_id: item.scheduleId,
            enabled: item.enabled,
          })),
        ),
      ],
    );
  }

  private mapAlertPreferences(row: AlertPreferencesRow) {
    return {
      enabled: row.enabled,
      minutesBefore: Number(row.minutes_before),
      vehicleType: row.vehicle_type,
      onlyFirstClassPerDay: row.only_first_class_per_day,
    };
  }
}
