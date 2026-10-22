import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AppModule, JwtPayload, PermissionAction, UserRole } from '../../common/constants';
import { CurrentUser, RequirePermissions, ResponseMessage, Roles } from '../../common/decorators';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  AdminRefundRedemptionDto,
  ListRedemptionsQueryDto,
} from '../dto/redemption.dto';
import { RedemptionsService } from '../services/redemptions.service';

@ApiTags('Admin - Redemptions')
@ApiBearerAuth()
@Controller('admin/redemptions')
@UseGuards(RolesGuard, PermissionsGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminRedemptionsController {
  constructor(private readonly redemptionsService: RedemptionsService) {}

  @Get()
  @RequirePermissions(AppModule.REWARDS, PermissionAction.VIEW)
  @ResponseMessage('Redemptions fetched successfully')
  list(@Query() query: ListRedemptionsQueryDto) {
    return this.redemptionsService.adminListRedemptions(query);
  }

  @Get(':id')
  @RequirePermissions(AppModule.REWARDS, PermissionAction.VIEW)
  @ResponseMessage('Redemption details fetched successfully')
  getById(@Param('id') id: string) {
    return this.redemptionsService.adminGetRedemptionById(id);
  }

  @Post(':id/refund')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(AppModule.REWARDS, PermissionAction.EDIT)
  @ResponseMessage('Redemption refunded and points restored successfully')
  refund(
    @Param('id') id: string,
    @Body() dto: AdminRefundRedemptionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.redemptionsService.adminRefundRedemption(id, dto, user.sub);
  }
}
