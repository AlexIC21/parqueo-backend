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
        startTime: row.start_time,
        endTime: row.end_time,
        subject: row.subject,
        classroom: row.classroom,
        isActive: row.is_active,
      })),
    };
  }

  async createSchedule(userId: number, dto: CreateScheduleDto) {
    const startMinutes = this.toMinutes(dto.startTime);
    const endMinutes = this.toMinutes(dto.endTime);

    if (endMinutes <= startMinutes) {
      throw new BadRequestException('endTime debe ser mayor que startTime.');
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
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, TRUE)
      RETURNING id, day_of_week, start_time, end_time, subject, classroom, is_active;
    `,
      [
        userId,
        dto.dayOfWeek,
        dto.startTime,
        dto.endTime,
        dto.subject ?? null,
        dto.classroom ?? null,
      ],
    );

    const row = result.rows[0];

    return {
      id: Number(row.id),
      dayOfWeek: Number(row.day_of_week),
      startTime: row.start_time,
      endTime: row.end_time,
      subject: row.subject,
      classroom: row.classroom,
      isActive: row.is_active,
    };
  }

  private toMinutes(time: string) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }
}
