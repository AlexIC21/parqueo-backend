import { IsIn, IsOptional } from 'class-validator';

export const SCREEN_COUNTER_VEHICLE_TYPES = ['AUTO', 'MOTO'] as const;
export const SCREEN_COUNTER_MOVEMENT_TYPES = ['ENTRADA', 'SALIDA'] as const;

export type ScreenCounterVehicleType =
  (typeof SCREEN_COUNTER_VEHICLE_TYPES)[number];
export type ScreenCounterMovementType =
  (typeof SCREEN_COUNTER_MOVEMENT_TYPES)[number];

export class CreateCounterMovementDto {
  @IsOptional()
  @IsIn(SCREEN_COUNTER_VEHICLE_TYPES, {
    message: 'vehicleType debe ser AUTO o MOTO',
  })
  vehicleType?: ScreenCounterVehicleType;

  @IsIn(SCREEN_COUNTER_MOVEMENT_TYPES, {
    message: 'movementType debe ser ENTRADA o SALIDA',
  })
  movementType: ScreenCounterMovementType;
}
