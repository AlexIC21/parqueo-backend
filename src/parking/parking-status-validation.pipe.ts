import { BadRequestException, PipeTransform } from '@nestjs/common';
import {
  PARKING_SPACE_STATUSES,
  ParkingSpaceStatus,
  UpdateParkingSpaceStatusDto,
} from './dto/update-parking-space-status.dto';

const invalidParkingStatusException = () =>
  new BadRequestException({
    success: false,
    message: 'Estado de espacio inválido',
  });

class ParkingStatusValidationPipe implements PipeTransform<
  unknown,
  UpdateParkingSpaceStatusDto
> {
  transform(value: unknown): UpdateParkingSpaceStatusDto {
    if (!value || typeof value !== 'object') {
      throw invalidParkingStatusException();
    }

    const dto = value as Partial<UpdateParkingSpaceStatusDto>;

    if (!PARKING_SPACE_STATUSES.includes(dto.status as ParkingSpaceStatus)) {
      throw invalidParkingStatusException();
    }

    return dto as UpdateParkingSpaceStatusDto;
  }
}

export const parkingStatusValidationPipe = new ParkingStatusValidationPipe();
