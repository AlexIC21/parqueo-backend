import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { ParkingModule } from '../parking/parking.module';
import {
  IncidentsController,
  UserIncidentsController,
} from './incidents.controller';
import { IncidentsService } from './incidents.service';

@Module({
  imports: [AuthModule, DatabaseModule, ParkingModule],
  controllers: [IncidentsController, UserIncidentsController],
  providers: [IncidentsService],
})
export class IncidentsModule {}
