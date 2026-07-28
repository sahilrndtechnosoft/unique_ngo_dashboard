import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AppModule, PermissionAction, UserRole } from '../../common/constants';
import { RequirePermissions, ResponseMessage, Roles } from '../../common/decorators';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ListAdminOrdersQueryDto, UpdateOrderStatusDto } from '../dto/order.dto';
import { AdminOrdersService } from '../services/orders.service';

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
