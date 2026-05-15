import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { NotificationsService } from './notifications.service';

interface AuthUser {
  id: number;
  role: string;
}

@Controller('api/v1/users/me/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('USUARIO')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getMyNotifications(@CurrentUser() user: AuthUser) {
    return {
      success: true,
      message: 'Notificaciones obtenidas correctamente',
      data: await this.notificationsService.getUserNotifications(user.id),
    };
  }

  @Patch(':id/read')
  async markAsRead(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return {
      success: true,
      message: 'Notificacion marcada como leida correctamente',
      data: await this.notificationsService.markAsRead(user.id, id),
    };
  }
}
