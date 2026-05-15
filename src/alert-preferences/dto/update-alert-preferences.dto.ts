import {
  IsBoolean,
  IsEmpty,
  IsIn,
  IsInt,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

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

  @IsBoolean()
  onlyFirstClassPerDay: boolean;
}
