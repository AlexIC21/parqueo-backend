import { IsInt, IsOptional, IsString, Max, MaxLength, Min, Matches } from 'class-validator';

export class CreateScheduleDto {
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek: number;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  startTime: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  endTime: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  classroom?: string;
}
