import { Module } from '@nestjs/common';
import { ParkingController } from './parking.controller';
import { ParkingService } from './parking.service';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { ParkingGateway } from './parking.gateway';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [ParkingController],
  providers: [ParkingService, ParkingGateway],
  exports: [ParkingService, ParkingGateway],
})
export class ParkingModule {}
