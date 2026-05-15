import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateScheduleDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek: number;

  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/)
  startTime: string;

  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/)
  endTime: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  subject: string;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  classroom?: string;
}
