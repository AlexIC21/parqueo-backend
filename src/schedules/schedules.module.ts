import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { SchedulesController } from './schedules.controller';
import { UsersController } from './users.controller';
import { SchedulesService } from './schedules.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [SchedulesController, UsersController],
  providers: [SchedulesService],
})
export class SchedulesModule {}
