import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
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
  @Roles('GUARDIA', 'ADMINISTRADOR')
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

  @Patch(':id/resolve')
  @Roles('GUARDIA', 'ADMINISTRADOR')
  async resolve(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return {
      success: true,
      message: 'Incidencia marcada como resuelta',
      data: await this.incidentsService.resolve(id, user),
    };
  }

  @Patch(':id/cancel')
  @Roles('GUARDIA', 'ADMINISTRADOR')
  async cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return {
      success: true,
      message: 'Incidencia cancelada correctamente',
      data: await this.incidentsService.cancel(id, user),
    };
  }
}

@Controller('api/v1/users/me/incidents')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('USUARIO')
export class UserIncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Get()
  async getMyIncidents(@CurrentUser() user: AuthUser) {
    const result = await this.incidentsService.findForUser(user.id);

    return {
      success: true,
      message: 'Incidencias del usuario obtenidas correctamente',
      data: result.data,
      meta: result.meta,
    };
  }

  @Patch(':id/read')
  async markAsRead(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return {
      success: true,
      message: 'Incidencia marcada como leida',
      data: await this.incidentsService.markAsRead(user.id, id),
    };
  }
}
