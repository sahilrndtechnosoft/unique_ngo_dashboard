import { Module } from '@nestjs/common';
import { AdminCouponsController, CouponsController } from './controllers/coupons.controller';
import { CouponsService } from './services/coupons.service';
import { RbacModule } from '../admin/rbac.module';

@Module({
  imports: [RbacModule],
  controllers: [CouponsController, AdminCouponsController],
  providers: [CouponsService],
  exports: [CouponsService],
})
export class CouponsModule {}
