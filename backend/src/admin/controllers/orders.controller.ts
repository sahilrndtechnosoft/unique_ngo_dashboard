import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AppModule, JwtPayload, PermissionAction, UserRole } from '../../common/constants';
import { CurrentUser, RequirePermissions, ResponseMessage, Roles } from '../../common/decorators';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateAdminSaleDto, FulfillShiprocketDto, ListAdminOrdersQueryDto, UpdateOrderStatusDto } from '../dto/order.dto';
import { AdminOrdersService } from '../services/orders.service';
import { ProductsService } from '../services/products.service';
import { OrdersService } from '../../orders/orders.service';
import { ShiprocketService } from '../services/shiprocket.service';

@ApiTags('Admin - Orders')
@ApiBearerAuth()
@Controller('admin/orders')
@UseGuards(RolesGuard, PermissionsGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminOrdersController {
  constructor(
    private readonly ordersService: AdminOrdersService,
    private readonly salesService: OrdersService,
    private readonly shiprocketService: ShiprocketService,
  ) {}

  @Post()
  @RequirePermissions(AppModule.ORDERS, PermissionAction.CREATE)
  @ResponseMessage('Sale recorded successfully')
  createSale(@Body() dto: CreateAdminSaleDto, @CurrentUser() actor: JwtPayload) {
    return this.salesService.createAdminSale(dto, actor.sub);
  }

  @Post(':id/shiprocket')
  @RequirePermissions(AppModule.ORDERS, PermissionAction.EDIT)
  @ResponseMessage('Shipment sent to Shiprocket')
  fulfillWithShiprocket(@Param('id') id: string, @Body() dto: FulfillShiprocketDto = {}) {
    return this.shiprocketService.fulfillOrder(id, dto.courierCompanyId);
  }

  @Get(':id/shiprocket/couriers')
  @RequirePermissions(AppModule.ORDERS, PermissionAction.VIEW)
  @ResponseMessage('Available Shiprocket couriers fetched successfully')
  getShiprocketCouriers(@Param('id') id: string) {
    return this.shiprocketService.getCourierOptions(id);
  }

  @Post(':id/shiprocket/refresh')
  @RequirePermissions(AppModule.ORDERS, PermissionAction.EDIT)
  @ResponseMessage('Shipment tracking refreshed')
  refreshShiprocketTracking(@Param('id') id: string) {
    return this.shiprocketService.refreshTracking(id);
  }

  @Post(':id/shiprocket/cancel')
  @RequirePermissions(AppModule.ORDERS, PermissionAction.EDIT)
  @ResponseMessage('Shiprocket shipment cancelled')
  cancelShiprocketShipment(@Param('id') id: string) {
    return this.shiprocketService.cancelShipment(id);
  }

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
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.ordersService.updateStatus(id, dto, actor.sub);
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
