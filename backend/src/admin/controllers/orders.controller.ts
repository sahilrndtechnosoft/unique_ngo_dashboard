import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AppModule, JwtPayload, PermissionAction, UserRole } from '../../common/constants';
import { CurrentUser, RequirePermissions, ResponseMessage, Roles } from '../../common/decorators';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ListAdminOrdersQueryDto, UpdateOrderStatusDto } from '../dto/order.dto';
import { AdminOrdersService } from '../services/orders.service';
import { ProductsService } from '../services/products.service';

@ApiTags('Admin - Orders')
@ApiBearerAuth()
@Controller('admin/orders')
@UseGuards(RolesGuard, PermissionsGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminOrdersController {
  constructor(private readonly ordersService: AdminOrdersService) {}

  @Get()
  @RequirePermissions(AppModule.ORDERS, PermissionAction.VIEW)
  @ResponseMessage('Orders fetched successfully')
  list(@Query() query: ListAdminOrdersQueryDto) {
    return this.ordersService.listOrders(query);
  }

  @Get(':id')
  @RequirePermissions(AppModule.ORDERS, PermissionAction.VIEW)
  @ResponseMessage('Order fetched successfully')
  get(@Param('id') id: string) {
    return this.ordersService.getOrder(id);
  }

  @Patch(':id/status')
  @RequirePermissions(AppModule.ORDERS, PermissionAction.EDIT)
  @ResponseMessage('Order status updated successfully')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.ordersService.updateStatus(id, dto);
  }
}

@ApiTags('Seller - Orders')
@ApiBearerAuth()
@Controller('seller/orders')
@UseGuards(RolesGuard)
@Roles(UserRole.SELLER)
export class SellerOrdersController {
  constructor(
    private readonly ordersService: AdminOrdersService,
    private readonly productsService: ProductsService,
  ) {}

  @Get()
  @ResponseMessage('Orders fetched successfully')
  async list(@Query() query: ListAdminOrdersQueryDto, @CurrentUser() user: JwtPayload) {
    const sellerId = await this.productsService.resolveSellerProfileId(user.sub);
    return this.ordersService.listOrders(query, { sellerId });
  }

  @Get(':id')
  @ResponseMessage('Order fetched successfully')
  async get(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const sellerId = await this.productsService.resolveSellerProfileId(user.sub);
    return this.ordersService.getOrder(id, sellerId);
  }
}
