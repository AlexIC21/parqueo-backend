import { Controller, Get } from '@nestjs/common';
import { ParkingService } from './parking.service';

@Controller('api/v1/parking')
export class ParkingController {
  constructor(private readonly parkingService: ParkingService) {}

  @Get('availability')
  async getAvailability() {
    return this.parkingService.getAvailability();
  }
  @Get('map/status')
async getMapStatus() {
  return this.parkingService.getMapStatus();
}
}
