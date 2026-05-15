import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { GuardController } from './guard.controller';
import { GuardService } from './guard.service';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [GuardController],
  providers: [GuardService],
})
export class GuardModule {}
