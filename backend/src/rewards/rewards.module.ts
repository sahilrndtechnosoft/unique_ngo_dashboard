import { Module } from '@nestjs/common';
import { RbacModule } from '../admin/rbac.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminRewardsController } from './controllers/admin-rewards.controller';
import { RewardsController } from './controllers/rewards.controller';
import { RewardRulesService } from './services/reward-rules.service';
import { RewardsService } from './services/rewards.service';

@Module({
  imports: [PrismaModule, RbacModule],
  controllers: [RewardsController, AdminRewardsController],
  providers: [RewardsService, RewardRulesService],
  exports: [RewardsService, RewardRulesService],
})
export class RewardsModule {}
