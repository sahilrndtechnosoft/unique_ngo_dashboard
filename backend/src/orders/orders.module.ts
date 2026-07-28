import { Module } from '@nestjs/common';
import { AddressesModule } from '../addresses/addresses.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [AddressesModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
