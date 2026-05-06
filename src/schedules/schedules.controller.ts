import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SchedulesService } from './schedules.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';

interface AuthUser {
  id: number;
  role: string;
}

@Controller('api/v1/schedules')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get()
  @Roles('USUARIO')
  async getSchedules(@CurrentUser() user: AuthUser) {
    return this.schedulesService.getSchedules(user.id);
  }

  @Post()
  @Roles('USUARIO')
  async createSchedule(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateScheduleDto,
  ) {
    return this.schedulesService.createSchedule(user.id, dto);
  }
}
