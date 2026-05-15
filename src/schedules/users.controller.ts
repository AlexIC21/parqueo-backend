import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SchedulesService } from './schedules.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { scheduleValidationPipe } from './schedule-validation.pipe';

interface AuthUser {
  id: number;
  role: string;
}

@Controller('api/v1/users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get('me/schedule')
  @Roles('USUARIO')
  async getMySchedule(@CurrentUser() user: AuthUser) {
    const data = await this.schedulesService.getUserSchedule(user.id);
    const hasClasses = data.classes.length > 0;

    return {
      success: true,
      message: hasClasses
        ? 'Horario obtenido correctamente'
        : 'El usuario no tiene clases registradas',
      data,
    };
  }

  @Post('me/schedule')
  @Roles('USUARIO')
  @UsePipes(scheduleValidationPipe)
  async createMySchedule(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateScheduleDto,
  ) {
    const data = await this.schedulesService.createSchedule(user.id, dto);

    return {
      success: true,
      message: 'Clase agregada correctamente',
      data,
    };
  }

  @Put('me/schedule/:id')
  @Roles('USUARIO')
  @UsePipes(scheduleValidationPipe)
  async updateMySchedule(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateScheduleDto,
  ) {
    const data = await this.schedulesService.updateSchedule(user.id, id, dto);

    return {
      success: true,
      message: 'Clase actualizada correctamente',
      data,
    };
  }

  @Delete('me/schedule/:id')
  @Roles('USUARIO')
  async deleteMySchedule(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const data = await this.schedulesService.deleteSchedule(user.id, id);

    return {
      success: true,
      message: 'Clase eliminada correctamente',
      data,
    };
  }
}
