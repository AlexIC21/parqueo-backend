import { Allow } from 'class-validator';

export const PARKING_SPACE_STATUSES = [
  'LIBRE',
  'OCUPADO',
  'MANTENIMIENTO',
] as const;

export type ParkingSpaceStatus = (typeof PARKING_SPACE_STATUSES)[number];

export class UpdateParkingSpaceStatusDto {
  @Allow()
  status: ParkingSpaceStatus;
}
