import { Module } from '@nestjs/common';
import { RbacModule } from '../admin/rbac.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminRewardsCatalogController } from './controllers/admin-rewards-catalog.controller';
import { RewardsCatalogController } from './controllers/rewards-catalog.controller';
import { RewardsCatalogService } from './services/rewards-catalog.service';

@Module({
  imports: [PrismaModule, RbacModule],
  controllers: [RewardsCatalogController, AdminRewardsCatalogController],
  providers: [RewardsCatalogService],
  exports: [RewardsCatalogService],
})
export class RewardsCatalogModule {}
