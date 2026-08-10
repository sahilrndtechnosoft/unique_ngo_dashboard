import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AppModule, JwtPayload, PermissionAction, UserRole } from '../../common/constants';
import { CurrentUser, RequirePermissions, ResponseMessage, Roles } from '../../common/decorators';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateCouponDto, ListCouponsQueryDto, UpdateCouponDto } from '../dto/coupon.dto';
import { CouponsService } from '../services/coupons.service';

@ApiTags('Coupons')
@ApiBearerAuth()
@Controller('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Get()
  @ResponseMessage('Available coupons fetched successfully')
  listAvailable(@CurrentUser() user: JwtPayload) {
    return this.couponsService.listAvailableForUser(user.sub);
  }
}

@ApiTags('Admin - Coupons')
@ApiBearerAuth()
@Controller('admin/coupons')
@UseGuards(RolesGuard, PermissionsGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminCouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Get()
  @RequirePermissions(AppModule.COUPONS, PermissionAction.VIEW)
  @ResponseMessage('Coupons fetched successfully')
  list(@Query() query: ListCouponsQueryDto) {
    return this.couponsService.adminList(query);
  }

  @Get(':id')
  @RequirePermissions(AppModule.COUPONS, PermissionAction.VIEW)
  @ResponseMessage('Coupon fetched successfully')
  get(@Param('id') id: string) {
    return this.couponsService.adminGet(id);
  }

  @Get(':id/usages')
  @RequirePermissions(AppModule.COUPONS, PermissionAction.VIEW)
  @ResponseMessage('Coupon usages fetched successfully')
  usages(@Param('id') id: string) {
    return this.couponsService.adminListUsages(id);
  }

  @Post()
  @RequirePermissions(AppModule.COUPONS, PermissionAction.CREATE)
  @ResponseMessage('Coupon created successfully')
  create(@Body() dto: CreateCouponDto, @CurrentUser() user: JwtPayload) {
    return this.couponsService.adminCreate(dto, user.sub);
  }

  @Patch(':id')
  @RequirePermissions(AppModule.COUPONS, PermissionAction.EDIT)
  @ResponseMessage('Coupon updated successfully')
  update(@Param('id') id: string, @Body() dto: UpdateCouponDto) {
    return this.couponsService.adminUpdate(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(AppModule.COUPONS, PermissionAction.DELETE)
  @ResponseMessage('Coupon deleted successfully')
  delete(@Param('id') id: string) {
    return this.couponsService.adminDelete(id);
  }
}
