import {
  IsArray,
  IsBoolean,
  IsEmpty,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SelectedScheduleAlertDto {
  @IsInt()
  @Min(1)
  scheduleId: number;

  @IsBoolean()
  enabled: boolean;
}

export class UpdateAlertPreferencesDto {
  @IsEmpty()
  userId?: never;

  @IsBoolean()
  enabled: boolean;

  @ValidateIf(
    (dto: UpdateAlertPreferencesDto) =>
      dto.enabled === true || dto.minutesBefore !== undefined,
  )
  @IsInt()
  @Min(1)
  @Max(180)
  minutesBefore?: number;

  @IsIn(['AUTO', 'MOTO'])
  vehicleType: 'AUTO' | 'MOTO';

  @IsOptional()
  @IsBoolean()
  onlyFirstClassPerDay?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SelectedScheduleAlertDto)
  selectedScheduleAlerts?: SelectedScheduleAlertDto[];
}
