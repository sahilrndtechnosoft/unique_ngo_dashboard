import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AppModule, JwtPayload, PermissionAction, UserRole } from '../../common/constants';
import { CurrentUser, ResponseMessage, Roles } from '../../common/decorators';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminDashboardService } from '../services/dashboard.service';
import { RbacService } from '../services/rbac.service';

@ApiTags('Admin - Dashboard')
@ApiBearerAuth()
@Controller('admin/dashboard')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminDashboardController {
  constructor(
    private readonly dashboardService: AdminDashboardService,
    private readonly rbacService: RbacService,
  ) {}

  @Get('overview')
  @ResponseMessage('Dashboard overview fetched successfully')
  async getOverview(@CurrentUser() actor: JwtPayload) {
    const isSuperAdmin = actor.role === UserRole.SUPER_ADMIN;
    const permissions = isSuperAdmin ? [] : await this.rbacService.getUserPermissions(actor.sub);
    const has = (module: AppModule, action: PermissionAction) =>
      isSuperAdmin || permissions.some((permission) => permission.module === module && permission.action === action);

    return this.dashboardService.getOverview({
      orders: has(AppModule.ORDERS, PermissionAction.VIEW),
      products: has(AppModule.PRODUCTS, PermissionAction.VIEW),
      sellers: has(AppModule.SELLERS, PermissionAction.VIEW),
      canCreateSale: has(AppModule.ORDERS, PermissionAction.VIEW) && has(AppModule.ORDERS, PermissionAction.CREATE),
      canReviewProducts: has(AppModule.PRODUCTS, PermissionAction.VIEW) && has(AppModule.PRODUCTS, PermissionAction.EDIT),
    });
  }
}
