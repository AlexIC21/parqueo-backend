import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { ParkingModule } from './parking/parking.module';
import { AuthModule } from './auth/auth.module';
import { SchedulesModule } from './schedules/schedules.module';
import { TestDbController } from './test-db.controller';
import { AlertPreferencesModule } from './alert-preferences/alert-preferences.module';
import { GuardModule } from './guard/guard.module';
import { IncidentsModule } from './incidents/incidents.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    ParkingModule,
    AuthModule,
    SchedulesModule,
    AlertPreferencesModule,
    GuardModule,
    IncidentsModule,
    NotificationsModule,
  ],
  controllers: [AppController, TestDbController],
  providers: [AppService],
})
export class AppModule {}
