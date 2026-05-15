import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { UpdateAlertPreferencesDto } from './dto/update-alert-preferences.dto';

interface AlertPreferencesRow {
  user_id: number;
  enabled: boolean;
  minutes_before: number;
  vehicle_type: 'AUTO' | 'MOTO';
  only_first_class_per_day: boolean;
}

@Injectable()
export class AlertPreferencesService {
  private readonly defaultPreferences = {
    enabled: true,
    minutesBefore: 30,
    vehicleType: 'AUTO' as const,
    onlyFirstClassPerDay: true,
  };

  constructor(private readonly databaseService: DatabaseService) {}

  async getMyAlertPreferences(userId: number) {
    const result = await this.databaseService.query<AlertPreferencesRow>(
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
    );

    const row = result.rows[0];

    if (!row) {
      return {
        userId,
        ...this.defaultPreferences,
      };
    }

    return this.mapAlertPreferences(row);
  }

  async upsertMyAlertPreferences(
    userId: number,
    dto: UpdateAlertPreferencesDto,
  ) {
    const minutesBefore =
      dto.minutesBefore ?? this.defaultPreferences.minutesBefore;

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
        dto.onlyFirstClassPerDay,
      ],
    );

    return this.mapAlertPreferences(result.rows[0]);
  }

  private mapAlertPreferences(row: AlertPreferencesRow) {
    return {
      userId: Number(row.user_id),
      enabled: row.enabled,
      minutesBefore: Number(row.minutes_before),
      vehicleType: row.vehicle_type,
      onlyFirstClassPerDay: row.only_first_class_per_day,
    };
  }
}
