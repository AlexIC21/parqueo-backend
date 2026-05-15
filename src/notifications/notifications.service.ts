import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../database/database.service';
import { ParkingGateway } from '../parking/parking.gateway';
import { ParkingService } from '../parking/parking.service';

const CLASS_SCHEDULE_ALERT = 'CLASS_SCHEDULE_ALERT';
const TIME_ZONE = 'America/La_Paz';

interface AlertPreferenceRow {
  user_id: number;
  enabled: boolean;
  minutes_before: number;
  vehicle_type: 'AUTO' | 'MOTO';
  only_first_class_per_day: boolean;
}

interface ScheduleClassRow {
  id: number;
  subject: string;
  start_time: string;
  classroom: string | null;
}

interface NotificationInsertRow extends NotificationRow {
  user_id: number;
}

interface NotificationRow {
  id: number;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown> | string | null;
  alert_date: Date | string;
  scheduled_for: Date | string | null;
  delivered_at: Date | string | null;
  read_at: Date | string | null;
  created_at?: Date | string | null;
  updated_at?: Date | string | null;
}

interface LocalDateTimeParts {
  date: string;
  dayOfWeek: number;
  hours: number;
  minutes: number;
}

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly parkingService: ParkingService,
    private readonly parkingGateway: ParkingGateway,
  ) {}

  async onModuleInit() {
    await this.ensureNotificationsTable();
  }

  @Cron(CronExpression.EVERY_MINUTE, { timeZone: TIME_ZONE })
  async generateClassScheduleAlerts() {
    const nowServer = new Date();
    const now = this.getLocalDateTimeParts(nowServer);
    const currentMinutes = now.hours * 60 + now.minutes;

    this.logger.log(
      `[CLASS-ALERT][CRON] nowLaPaz=${now.date} ${this.minutesToTime(
        currentMinutes,
      )} dayOfWeek=${now.dayOfWeek} currentTime=${this.minutesToTime(
        currentMinutes,
      )}`,
    );

    try {
      const preferences = await this.getAlertPreferences();

      this.logger.log(
        `[CLASS-ALERT][PREFS] usuariosConPreferencias=${preferences.length}`,
      );

      for (const preference of preferences) {
        this.logger.log(
          `[CLASS-ALERT][USER] userId=${preference.user_id} enabled=${preference.enabled} ` +
            `minutesBefore=${preference.minutes_before}`,
        );

        try {
          if (!preference.enabled) {
            this.logger.log(
              `[CLASS-ALERT][USER] userId=${preference.user_id} alertas desactivadas`,
            );
            continue;
          }

          await this.generateUserClassScheduleAlerts(preference, now);
        } catch (error) {
          this.logger.error(
            `[CLASS-ALERT][ERROR] userId=${preference.user_id} error=${
              error instanceof Error ? error.message : 'Error desconocido'
            }`,
            error instanceof Error ? error.stack : undefined,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `[CLASS-ALERT][ERROR] error=${
          error instanceof Error ? error.message : 'Error desconocido'
        }`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async generateUserClassScheduleAlerts(
    preference: AlertPreferenceRow,
    now: LocalDateTimeParts,
  ) {
    const classes = await this.getTodayClasses(preference.user_id, now.dayOfWeek);

    this.logger.log(
      `[CLASS-ALERT][SCHEDULES] userId=${preference.user_id} count=${classes.length}`,
    );

    for (const classItem of classes) {
      this.logger.log(
        `[CLASS-ALERT][SCHEDULE] scheduleId=${classItem.id} subject=${classItem.subject} startTime=${this.formatTime(
          classItem.start_time,
        )}`,
      );

      await this.generateCandidateAlert(preference, classItem, now);
    }
  }

  async getUserNotifications(userId: number) {
    const result = await this.databaseService.query<NotificationRow>(
      `
      SELECT
        id,
        type,
        title,
        message,
        data,
        alert_date,
        scheduled_for,
        delivered_at,
        read_at,
        created_at
      FROM user_notifications
      WHERE user_id = $1
      ORDER BY created_at DESC, id DESC;
    `,
      [userId],
    );

    return result.rows.map((row) => this.mapNotification(row));
  }

  async markAsRead(userId: number, notificationId: number) {
    const result = await this.databaseService.query<NotificationRow>(
      `
      UPDATE user_notifications
      SET
        read_at = COALESCE(read_at, NOW()),
        updated_at = NOW()
      WHERE id = $1
        AND user_id = $2
      RETURNING
        id,
        type,
        title,
        message,
        data,
        alert_date,
        scheduled_for,
        delivered_at,
        read_at,
        created_at;
    `,
      [notificationId, userId],
    );

    const notification = result.rows[0];

    if (!notification) {
      throw new NotFoundException({
        success: false,
        message: 'Notificacion no encontrada',
      });
    }

    return this.mapNotification(notification);
  }

  private async ensureNotificationsTable() {
    await this.databaseService.query(`
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

      DROP INDEX IF EXISTS idx_user_notifications_schedule_class_unique;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_user_notifications_schedule_class_unique
        ON user_notifications (user_id, type, alert_date, ((data->>'scheduleId')))
        WHERE type = 'CLASS_SCHEDULE_ALERT';

      CREATE INDEX IF NOT EXISTS idx_user_notifications_user_created_at
        ON user_notifications (user_id, created_at DESC);
    `);
  }

  private async getAlertPreferences() {
    const result = await this.databaseService.query<AlertPreferenceRow>(
      `
      SELECT
        preferences.user_id,
        preferences.enabled,
        preferences.minutes_before,
        preferences.vehicle_type,
        COALESCE(preferences.only_first_class_per_day, FALSE) AS only_first_class_per_day
      FROM user_alert_preferences preferences
      INNER JOIN users users
        ON users.id = preferences.user_id
      WHERE users.role = 'USUARIO'
        AND users.is_active = TRUE;
    `,
    );

    return result.rows;
  }

  private async getTodayClasses(userId: number, dayOfWeek: number) {
    const result = await this.databaseService.query<ScheduleClassRow>(
      `
      SELECT
        id,
        subject,
        start_time,
        classroom
      FROM user_schedules
      WHERE user_id = $1
        AND day_of_week = $2
        AND is_active = TRUE
      ORDER BY start_time ASC;
    `,
      [userId, dayOfWeek],
    );

    return result.rows;
  }

  private async generateCandidateAlert(
    preference: AlertPreferenceRow,
    classItem: ScheduleClassRow,
    now: LocalDateTimeParts,
  ) {
    const startMinutes = this.timeToMinutes(classItem.start_time);
    const minutesBefore = Number(preference.minutes_before ?? 0);
    const alertMinutes = startMinutes - minutesBefore;
    const currentMinutes = now.hours * 60 + now.minutes;
    const shouldGenerate = alertMinutes >= 0 && alertMinutes === currentMinutes;

    this.logger.log(
      `[CLASS-ALERT][TIME] scheduleId=${classItem.id} startTime=${this.formatTime(
        classItem.start_time,
      )} alertTime=${this.formatMinutesForLog(
        alertMinutes,
      )} currentTime=${this.minutesToTime(
          currentMinutes,
        )} shouldGenerate=${shouldGenerate}`,
    );

    if (!shouldGenerate) {
      return;
    }

    const duplicateExists = await this.hasScheduleAlert(
      preference.user_id,
      now.date,
      Number(classItem.id),
    );

    this.logger.log(
      `[CLASS-ALERT][DUPLICATE] scheduleId=${classItem.id} exists=${duplicateExists}`,
    );

    if (duplicateExists) {
      return;
    }

    const availability = await this.parkingService.getAvailabilitySummary();
    this.logger.log(
      `[CLASS-ALERT][AVAILABILITY] cars=${availability.cars.available}/${availability.cars.totalCapacity} ` +
        `motorcycles=${availability.motorcycles.available}/${availability.motorcycles.totalCapacity} ` +
        `occupancy=${availability.total.occupancyPercentage} generalStatus=${availability.generalStatus}`,
    );

    const startTime = this.formatTime(classItem.start_time);
    const scheduledFor = `${now.date} ${this.minutesToTime(alertMinutes)}:00`;
    const title = 'Disponibilidad del parqueo';
    const message =
      availability.cars.available > 0
        ? `Quedan ${availability.cars.available} espacios disponibles.`
        : 'Ya no quedan espacios disponibles.';
    const data = {
      scheduleId: Number(classItem.id),
      subject: classItem.subject,
      startTime,
      classroom: classItem.classroom,
      availability: {
        cars: {
          available: availability.cars.available,
          totalCapacity: availability.cars.totalCapacity,
        },
        motorcycles: {
          available: availability.motorcycles.available,
          totalCapacity: availability.motorcycles.totalCapacity,
        },
      },
    };

    const result = await this.databaseService.query<NotificationInsertRow>(
      `
      INSERT INTO user_notifications (
        user_id,
        type,
        title,
        message,
        data,
        alert_date,
        scheduled_for,
        delivered_at,
        created_at,
        updated_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5::jsonb,
        $6::date,
        $7::timestamp,
        NOW(),
        NOW(),
        NOW()
      )
      ON CONFLICT DO NOTHING
      RETURNING
        id,
        user_id,
        type,
        title,
        message,
        data,
        alert_date,
        scheduled_for,
        delivered_at,
        read_at,
        created_at;
    `,
      [
        preference.user_id,
        CLASS_SCHEDULE_ALERT,
        title,
        message,
        JSON.stringify(data),
        now.date,
        scheduledFor,
      ],
    );

    const notification = result.rows[0];

    if (!notification) {
      this.logger.log(
        `[CLASS-ALERT][DUPLICATE] scheduleId=${classItem.id} exists=true`,
      );
      return;
    }

    this.logger.log(
      `[CLASS-ALERT][CREATED] notificationId=${notification.id} scheduleId=${classItem.id}`,
    );
    this.parkingGateway.emitNotificationCreated(
      this.mapNotification(notification),
    );
    this.logger.log('[CLASS-ALERT][SOCKET] emitted user.notification.created');
  }

  private async hasScheduleAlert(
    userId: number,
    alertDate: string,
    scheduleId: number,
  ) {
    const result = await this.databaseService.query<{ exists: boolean }>(
      `
      SELECT EXISTS (
        SELECT 1
        FROM user_notifications
        WHERE user_id = $1
          AND type = $2
          AND alert_date = $3::date
          AND data->>'scheduleId' = $4
      ) AS exists;
    `,
      [userId, CLASS_SCHEDULE_ALERT, alertDate, String(scheduleId)],
    );

    return result.rows[0]?.exists === true;
  }

  private getLocalDateTimeParts(date: Date): LocalDateTimeParts {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: TIME_ZONE,
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .reduce<Record<string, string>>((acc, part) => {
        acc[part.type] = part.value;
        return acc;
      }, {});

    return {
      date: `${parts.year}-${parts.month}-${parts.day}`,
      dayOfWeek: this.weekdayToDayOfWeek(parts.weekday),
      hours: Number(parts.hour),
      minutes: Number(parts.minute),
    };
  }

  private weekdayToDayOfWeek(value: string) {
    const weekdays: Record<string, number> = {
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
      Sun: 7,
    };

    return weekdays[value] ?? 1;
  }

  private timeToMinutes(value: string) {
    const [hours, minutes] = String(value).split(':').map(Number);
    return hours * 60 + minutes;
  }

  private minutesToTime(value: number) {
    const hours = Math.floor(value / 60);
    const minutes = value % 60;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  private formatMinutesForLog(value: number) {
    if (value < 0) {
      return `fuera-del-dia(${value}min)`;
    }

    return this.minutesToTime(value);
  }

  private formatTime(value: string) {
    const text = String(value ?? '');

    return text.length >= 5 ? text.slice(0, 5) : text;
  }

  private mapNotification(row: NotificationRow) {
    return {
      id: Number(row.id),
      type: row.type,
      title: row.title,
      message: row.message,
      data: this.parseJson(row.data),
      alertDate: this.toDateString(row.alert_date),
      scheduledFor: this.toIsoString(row.scheduled_for),
      deliveredAt: this.toIsoString(row.delivered_at),
      readAt: this.toIsoString(row.read_at),
      createdAt: this.toIsoString(row.created_at ?? null),
    };
  }

  private parseJson(value: Record<string, unknown> | string | null) {
    if (!value) {
      return {};
    }

    if (typeof value === 'string') {
      return JSON.parse(value) as Record<string, unknown>;
    }

    return value;
  }

  private toDateString(value: Date | string) {
    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }

    return String(value).slice(0, 10);
  }

  private toIsoString(value: Date | string | null) {
    if (!value) {
      return null;
    }

    return value instanceof Date
      ? value.toISOString()
      : new Date(value).toISOString();
  }
}
