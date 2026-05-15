import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { IncidentsService } from './incidents.service';

interface AuthUser {
  id: number;
  role: string;
}

@Controller('api/v1/incidents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Get()
  @Roles('USUARIO', 'GUARDIA', 'ADMINISTRADOR')
  async findAll() {
    return {
      success: true,
      message: 'Incidencias obtenidas correctamente',
      data: await this.incidentsService.findAll(),
    };
  }

  @Post()
  @Roles('GUARDIA', 'ADMINISTRADOR')
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  )
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateIncidentDto) {
    return {
      success: true,
      message: 'Incidencia registrada correctamente',
      data: await this.incidentsService.create(dto, user),
    };
  }
}
