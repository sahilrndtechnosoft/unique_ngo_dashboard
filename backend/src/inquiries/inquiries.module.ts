import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { AdminInquiriesController, InquiriesController } from './controllers/inquiries.controller';
import { InquiriesService } from './services/inquiries.service';

@Module({
  imports: [AdminModule],
  controllers: [InquiriesController, AdminInquiriesController],
  providers: [InquiriesService],
})
export class InquiriesModule {}
