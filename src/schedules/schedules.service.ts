import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';

@Injectable()
export class SchedulesService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getSchedules(userId: number) {
    const result = await this.databaseService.query(
      `
      SELECT
        id,
        day_of_week,
        start_time,
        end_time,
        subject,
        classroom,
        is_active
      FROM user_schedules
      WHERE user_id = $1
        AND is_active = TRUE
      ORDER BY day_of_week, start_time;
    `,
      [userId],
    );

    return {
      schedules: result.rows.map((row) => ({
        id: Number(row.id),
        dayOfWeek: Number(row.day_of_week),
        dayName: this.getDayName(row.day_of_week),
        startTime: this.formatTime(row.start_time),
        endTime: this.formatTime(row.end_time),
        subject: row.subject,
        classroom: row.classroom,
        isActive: row.is_active,
      })),
    };
  }

  async createSchedule(userId: number, dto: CreateScheduleDto) {
    const subject = dto.subject?.trim();
    const classroom = dto.classroom?.trim() || null;

    if (!subject) {
      throw new BadRequestException({
        success: false,
        message: 'La materia es obligatoria',
      });
    }

    const startSeconds = this.toSeconds(dto.startTime);
    const endSeconds = this.toSeconds(dto.endTime);

    if (endSeconds <= startSeconds) {
      throw new BadRequestException({
        success: false,
        message: 'La hora de inicio debe ser menor a la hora de fin',
      });
    }

    const result = await this.databaseService.query(
      `
      INSERT INTO user_schedules (
        user_id,
        day_of_week,
        start_time,
        end_time,
        subject,
        classroom,
        is_active,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW(), NOW())
      RETURNING id, day_of_week, start_time, end_time, subject, classroom, is_active;
    `,
      [
        userId,
        dto.dayOfWeek,
        this.normalizeTime(dto.startTime),
        this.normalizeTime(dto.endTime),
        subject,
        classroom,
      ],
    );

    const row = result.rows[0];

    return {
      id: Number(row.id),
      userId,
      dayOfWeek: Number(row.day_of_week),
      dayName: this.getDayName(row.day_of_week),
      startTime: this.formatTime(row.start_time),
      endTime: this.formatTime(row.end_time),
      subject: row.subject,
      classroom: row.classroom,
      isActive: row.is_active,
    };
  }

  private toSeconds(time: string) {
    const [hours, minutes, seconds = 0] = time.split(':').map(Number);
    return hours * 3600 + minutes * 60 + seconds;
  }

  private normalizeTime(time: string) {
    return time.length === 5 ? `${time}:00` : time;
  }

  private formatTime(time: unknown) {
    const value = String(time ?? '');
    return /^\d{2}:\d{2}:\d{2}$/.test(value) && value.endsWith(':00')
      ? value.slice(0, 5)
      : value;
  }

  async getUserSchedule(userId: number) {
    const result = await this.databaseService.query(
      `
      SELECT
        id,
        day_of_week,
        start_time,
        end_time,
        subject,
        classroom,
        is_active
      FROM user_schedules
      WHERE user_id = $1
        AND is_active = TRUE
      ORDER BY day_of_week, start_time;
    `,
      [userId],
    );

    return {
      userId,
      classes: result.rows.map((row) => ({
        id: Number(row.id),
        dayOfWeek: Number(row.day_of_week),
        dayName: this.getDayName(row.day_of_week),
        startTime: this.formatTime(row.start_time),
        endTime: this.formatTime(row.end_time),
        subject: row.subject,
        classroom: row.classroom,
        isActive: row.is_active,
      })),
    };
  }

  private getDayName(value: unknown) {
    const numericValue = Number(value);
    const dayNames = [
      'Lunes',
      'Martes',
      'Miércoles',
      'Jueves',
      'Viernes',
      'Sábado',
      'Domingo',
    ];

    if (numericValue >= 1 && numericValue <= 7) {
      return dayNames[numericValue - 1];
    }

    return '';
  }
}
