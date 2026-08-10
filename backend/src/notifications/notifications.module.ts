import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { AdminNotificationsController } from './controllers/admin-notifications.controller';
import { DeviceTokensController } from './controllers/device-tokens.controller';
import { DeviceTokensService } from './services/device-tokens.service';
import { FcmService } from './services/fcm.service';
import { MailService } from './services/mail.service';
import { NotificationsService } from './services/notifications.service';

@Module({
  imports: [AdminModule],
  controllers: [DeviceTokensController, AdminNotificationsController],
  providers: [FcmService, DeviceTokensService, MailService, NotificationsService],
  exports: [NotificationsService, DeviceTokensService],
})
export class NotificationsModule {}
