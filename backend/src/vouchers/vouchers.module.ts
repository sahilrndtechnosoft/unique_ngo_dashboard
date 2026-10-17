import { Module } from '@nestjs/common';
import { RbacModule } from '../admin/rbac.module';
import { PartnersModule } from '../partners/partners.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminVouchersController } from './controllers/admin-vouchers.controller';
import { VouchersController } from './controllers/vouchers.controller';
import { VouchersService } from './services/vouchers.service';

@Module({
  imports: [PrismaModule, PartnersModule, RbacModule],
  controllers: [VouchersController, AdminVouchersController],
  providers: [VouchersService],
  exports: [VouchersService],
})
export class VouchersModule {}
