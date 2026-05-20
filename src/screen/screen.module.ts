import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { ParkingModule } from '../parking/parking.module';
import { ContadorController } from './contador.controller';
import { ScreenCounterService } from './screen-counter.service';
import { ScreenController } from './screen.controller';

@Module({
  imports: [AuthModule, DatabaseModule, ParkingModule],
  controllers: [ScreenController, ContadorController],
  providers: [ScreenCounterService],
})
export class ScreenModule {}
