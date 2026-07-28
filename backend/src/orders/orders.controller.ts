import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtPayload } from '../common/constants';
import { CurrentUser, ResponseMessage } from '../common/decorators';
import { CheckoutDto, ListOrdersQueryDto } from './dto/order.dto';
import { OrdersService } from './orders.service';

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('checkout')
  @ResponseMessage('Order placed successfully')
  checkout(@CurrentUser() user: JwtPayload, @Body() dto: CheckoutDto) {
    return this.ordersService.checkout(user.sub, dto);
  }

  @Get()
  @ResponseMessage('Orders fetched successfully')
  list(@CurrentUser() user: JwtPayload, @Query() query: ListOrdersQueryDto) {
    return this.ordersService.listOrders(user.sub, query);
  }

  @Get(':id')
  @ResponseMessage('Order fetched successfully')
  get(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.ordersService.getOrder(user.sub, id);
  }
}
