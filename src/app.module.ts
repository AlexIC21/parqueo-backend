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
import { ScreenModule } from './screen/screen.module';

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
    ScreenModule,
  ],
  controllers: [AppController, TestDbController],
  providers: [AppService],
})
export class AppModule {}
