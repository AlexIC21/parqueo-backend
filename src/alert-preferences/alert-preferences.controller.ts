import {
  Body,
  Controller,
  Get,
  Put,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AlertPreferencesService } from './alert-preferences.service';
import { alertPreferencesValidationPipe } from './alert-preferences-validation.pipe';
import { UpdateAlertPreferencesDto } from './dto/update-alert-preferences.dto';

interface AuthUser {
  id: number;
  role: string;
}

@Controller('api/v1/users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AlertPreferencesController {
  constructor(
    private readonly alertPreferencesService: AlertPreferencesService,
  ) {}

  @Get('me/alert-preferences')
  @Roles('USUARIO')
  async getMyAlertPreferences(@CurrentUser() user: AuthUser) {
    const data = await this.alertPreferencesService.getMyAlertPreferences(
      user.id,
    );

    return {
      success: true,
      message: 'Configuración de alertas obtenida correctamente',
      data,
    };
  }

  @Put('me/alert-preferences')
  @Roles('USUARIO')
  @UsePipes(alertPreferencesValidationPipe)
  async updateMyAlertPreferences(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateAlertPreferencesDto,
  ) {
    const data = await this.alertPreferencesService.upsertMyAlertPreferences(
      user.id,
      dto,
    );

    return {
      success: true,
      message: 'Configuración de alertas actualizada correctamente',
      data,
    };
  }
}
