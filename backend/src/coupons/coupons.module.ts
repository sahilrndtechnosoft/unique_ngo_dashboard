import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { AdminCouponsController, CouponsController } from './controllers/coupons.controller';
import { CouponsService } from './services/coupons.service';

@Module({
  imports: [AdminModule],
  controllers: [CouponsController, AdminCouponsController],
  providers: [CouponsService],
  exports: [CouponsService],
})
export class CouponsModule {}
