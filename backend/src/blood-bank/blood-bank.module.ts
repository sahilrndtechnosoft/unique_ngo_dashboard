import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { AdminAppointmentsController, AppointmentsController } from './controllers/appointments.controller';
import { AdminBloodRequestsController, BloodRequestsController } from './controllers/blood-requests.controller';
import { AdminCampaignsController, CampaignsController } from './controllers/campaigns.controller';
import { AdminDonationsController, DonationsController } from './controllers/donations.controller';
import { AdminHospitalsController, HospitalsController } from './controllers/hospitals.controller';
import { SheetImportController } from './controllers/sheet-import.controller';
import { AppointmentsService } from './services/appointments.service';
import { BloodRequestsService } from './services/blood-requests.service';
import { CampaignsService } from './services/campaigns.service';
import { DonationsService } from './services/donations.service';
import { HospitalsService } from './services/hospitals.service';
import { RewardsService } from './services/rewards.service';
import { SheetImportService } from './services/sheet-import.service';

@Module({
  imports: [AdminModule],
  controllers: [
    AdminHospitalsController,
    HospitalsController,
    AdminCampaignsController,
    CampaignsController,
    AppointmentsController,
    AdminAppointmentsController,
    DonationsController,
    AdminDonationsController,
    SheetImportController,
    BloodRequestsController,
    AdminBloodRequestsController,
  ],
  providers: [
    HospitalsService,
    CampaignsService,
    AppointmentsService,
    DonationsService,
    RewardsService,
    SheetImportService,
    BloodRequestsService,
  ],
})
export class BloodBankModule {}
