import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { Roles } from './auth/decorators/roles.decorator';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { DatabaseService } from './database/database.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class TestDbController {
  constructor(private readonly databaseService: DatabaseService) {}

  @Get('test-db')
  @Roles('ADMINISTRADOR')
  async testDb() {
    try {
      const result = await this.databaseService.query<{ now: string }>(
        'SELECT NOW()',
      );
      const databaseTime = result.rows[0]?.now;

      return {
        status: 'ok',
        message: 'Conexión exitosa con la base de datos',
        databaseTime,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: 'No se pudo conectar con la base de datos',
          error: error instanceof Error ? error.message : 'Error desconocido',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
