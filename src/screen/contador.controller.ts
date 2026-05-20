import { Body, Controller, Get, Post } from '@nestjs/common';
import { CreateCounterMovementDto } from './dto/create-counter-movement.dto';
import { ScreenCounterService } from './screen-counter.service';

@Controller('api/v1/contador')
export class ContadorController {
  constructor(private readonly screenCounterService: ScreenCounterService) {}

  // TODO: Proteger este endpoint despues de la demo usando JWT o SENSOR_API_KEY.
  @Get()
  async getCounter() {
    return {
      success: true,
      message: 'Contador obtenido correctamente',
      data: await this.screenCounterService.getPublicCounter('AUTO'),
    };
  }

  // TODO: Proteger este endpoint despues de la demo usando JWT o SENSOR_API_KEY.
  @Post('movimiento')
  async createMovement(@Body() dto: CreateCounterMovementDto) {
    return {
      success: true,
      message: 'Movimiento registrado correctamente',
      data: await this.screenCounterService.registerPublicMovement(
        dto.vehicleType ?? 'AUTO',
        dto.movementType,
      ),
    };
  }
}
