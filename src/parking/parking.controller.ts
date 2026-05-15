import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ParkingService } from './parking.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UpdateParkingSpaceStatusDto } from './dto/update-parking-space-status.dto';
import { parkingStatusValidationPipe } from './parking-status-validation.pipe';
import { ParkingGateway } from './parking.gateway';

@Controller('api/v1/parking')
export class ParkingController {
  constructor(
    private readonly parkingService: ParkingService,
    private readonly parkingGateway: ParkingGateway,
  ) {}

  @Get('availability')
  async getAvailability(): Promise<Record<string, unknown>> {
    const availability = await this.parkingService.getAvailabilityBundle();

    return {
      success: true,
      message: 'Disponibilidad obtenida correctamente',
      data: availability.summary,
      parkingLotId: availability.raw.parkingLotId,
      parkingLotName: availability.raw.parkingLotName,
      autosCapacity: availability.raw.autosCapacity,
      autosOccupied: availability.raw.autosOccupied,
      autosMaintenance: availability.raw.autosMaintenance,
      autosAvailable: availability.raw.autosAvailable,
      motosCapacity: availability.raw.motosCapacity,
      motosOccupied: availability.raw.motosOccupied,
      motosAvailable: availability.raw.motosAvailable,
      totalCapacity: availability.raw.totalCapacity,
      totalOccupied: availability.raw.totalOccupied,
      totalOccupancyPercent: availability.raw.totalOccupancyPercent,
      status: availability.raw.status,
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USUARIO', 'ADMINISTRADOR', 'GUARDIA')
  @Get('map')
  async getMap(): Promise<Record<string, unknown>> {
    return {
      success: true,
      message: 'Mapa obtenido correctamente',
      data: await this.parkingService.getMapInfo(),
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USUARIO', 'ADMINISTRADOR', 'GUARDIA')
  @Get('map/status')
  async getMapStatus(): Promise<Record<string, unknown>> {
    return this.parkingService.getMapStatus();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('GUARDIA', 'ADMINISTRADOR')
  @Patch('spaces/:id/status')
  async updateSpaceStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body(parkingStatusValidationPipe) dto: UpdateParkingSpaceStatusDto,
  ) {
    const data = await this.parkingService.updateSpaceStatus(id, dto);
    this.parkingGateway.emitSpaceUpdated(data);

    return {
      success: true,
      message: 'Estado del espacio actualizado correctamente',
      data,
    };
  }
}
