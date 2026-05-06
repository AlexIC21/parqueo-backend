import { Controller, Get, UseGuards } from '@nestjs/common';
import { ParkingService } from './parking.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('api/v1/parking')
export class ParkingController {
  constructor(private readonly parkingService: ParkingService) {}

  @Get('availability')
  async getAvailability() {
    return this.parkingService.getAvailability();
  }

  @UseGuards(JwtAuthGuard)
  @Get('map/status')
  async getMapStatus() {
    return this.parkingService.getMapStatus();
  }
}
