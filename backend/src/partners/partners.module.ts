import { Module } from '@nestjs/common';
import { RbacModule } from '../admin/rbac.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MockPartnerAdapter } from './adapters/mock-partner.adapter';
import { PartnerAdapterFactory } from './adapters/partner-adapter.factory';
import { PizzaHutPartnerAdapter } from './adapters/pizza-hut.adapter';
import { AdminPartnersController } from './controllers/admin-partners.controller';
import { PartnersController } from './controllers/partners.controller';
import { PartnersService } from './services/partners.service';

@Module({
  imports: [PrismaModule, RbacModule],
  controllers: [PartnersController, AdminPartnersController],
  providers: [
    MockPartnerAdapter,
    PizzaHutPartnerAdapter,
    PartnerAdapterFactory,
    PartnersService,
  ],
  exports: [PartnersService, PartnerAdapterFactory],
})
export class PartnersModule {}
