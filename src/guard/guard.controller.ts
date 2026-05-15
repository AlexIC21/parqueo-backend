import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { GuardService } from './guard.service';

interface CounterUpdateDto {
  value?: number;
  count?: number;
}

@Controller('api/v1/guard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('GUARDIA', 'ADMINISTRADOR')
export class GuardController {
  constructor(private readonly guardService: GuardService) {}

  @Get('dashboard')
  async getDashboard(): Promise<Record<string, unknown>> {
    return {
      success: true,
      message: 'Panel de guardia obtenido correctamente',
      data: await this.guardService.getDashboard(),
    };
  }

  @Patch('counters/cars-leaving')
  updateCarsLeaving(@Body() dto: CounterUpdateDto): Record<string, unknown> {
    return {
      success: true,
      message: 'Contador de autos salientes actualizado correctamente',
      data: this.guardService.updateCarsLeaving(dto),
    };
  }

  @Patch('counters/motorcycles-leaving')
  updateMotorcyclesLeaving(
    @Body() dto: CounterUpdateDto,
  ): Record<string, unknown> {
    return {
      success: true,
      message: 'Contador de motos salientes actualizado correctamente',
      data: this.guardService.updateMotorcyclesLeaving(dto),
    };
  }

  @Patch('counters/vehicle-queue')
  updateVehicleQueue(@Body() dto: CounterUpdateDto): Record<string, unknown> {
    return {
      success: true,
      message: 'Contador de cola vehicular actualizado correctamente',
      data: this.guardService.updateVehicleQueue(dto),
    };
  }
}
