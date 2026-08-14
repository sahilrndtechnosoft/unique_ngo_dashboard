import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminDonationItemsController, DonationItemsController } from './controllers/donation-items.controller';
import {
  AdminDonationItemRequestsController,
  DonationItemRequestsController,
} from './controllers/donation-item-requests.controller';
import {
  AdminDonationTransfersController,
  DonationTransfersController,
} from './controllers/donation-transfers.controller';
import { DonationItemsService } from './services/donation-items.service';
import { DonationItemRequestsService } from './services/donation-item-requests.service';
import { DonationTransfersService } from './services/donation-transfers.service';

@Module({
  imports: [AdminModule, NotificationsModule],
  controllers: [
    DonationItemsController,
    AdminDonationItemsController,
    DonationItemRequestsController,
    AdminDonationItemRequestsController,
    DonationTransfersController,
    AdminDonationTransfersController,
  ],
  providers: [DonationItemsService, DonationItemRequestsService, DonationTransfersService],
})
export class DonationItemsModule {}
