import { Module } from '@nestjs/common';
import { RbacModule } from '../admin/rbac.module';
import { PartnersModule } from '../partners/partners.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RewardsCatalogModule } from '../rewards-catalog/rewards-catalog.module';
import { RewardsModule } from '../rewards/rewards.module';
import { VouchersModule } from '../vouchers/vouchers.module';
import { AdminRedemptionsController } from './controllers/admin-redemptions.controller';
import { RedemptionsController } from './controllers/redemptions.controller';
import { RedemptionsService } from './services/redemptions.service';

@Module({
  imports: [
    PrismaModule,
    RewardsModule,
    RewardsCatalogModule,
    VouchersModule,
    PartnersModule,
    RbacModule,
  ],
  controllers: [RedemptionsController, AdminRedemptionsController],
  providers: [RedemptionsService],
  exports: [RedemptionsService],
})
export class RedemptionsModule {}
