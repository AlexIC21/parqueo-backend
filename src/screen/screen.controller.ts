import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateCounterMovementDto } from './dto/create-counter-movement.dto';
import {
  ScreenCounterAuthUser,
  ScreenCounterService,
} from './screen-counter.service';

@Controller('api/v1/screen')
@UseGuards(JwtAuthGuard)
export class ScreenController {
  constructor(private readonly screenCounterService: ScreenCounterService) {}

  @Get('counter')
  async getCounter(@CurrentUser() user: ScreenCounterAuthUser) {
    return {
      success: true,
      message: 'Contador obtenido correctamente',
      data: await this.screenCounterService.getCounter(user),
    };
  }

  @Post('counter/movement')
  async createMovement(
    @CurrentUser() user: ScreenCounterAuthUser,
    @Body() dto: CreateCounterMovementDto,
  ) {
    return {
      success: true,
      message: 'Movimiento registrado correctamente',
      data: await this.screenCounterService.registerMovement(
        user,
        dto.vehicleType ?? 'AUTO',
        dto.movementType,
      ),
    };
  }
}
