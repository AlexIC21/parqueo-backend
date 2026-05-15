import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ParkingModule } from '../parking/parking.module';
import { GuardController } from './guard.controller';
import { GuardService } from './guard.service';

@Module({
  imports: [AuthModule, ParkingModule],
  controllers: [GuardController],
  providers: [GuardService],
})
export class GuardModule {}
