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
  AdminIssueVoucherDto,
  CancelVoucherDto,
  ListAllVouchersQueryDto,
} from '../dto/voucher.dto';
import { VouchersService } from '../services/vouchers.service';

@ApiTags('Admin - Vouchers')
@ApiBearerAuth()
@Controller('admin/vouchers')
@UseGuards(RolesGuard, PermissionsGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminVouchersController {
  constructor(private readonly vouchersService: VouchersService) {}

  @Get()
  @RequirePermissions(AppModule.REWARDS, PermissionAction.VIEW)
  @ResponseMessage('Vouchers fetched successfully')
  list(@Query() query: ListAllVouchersQueryDto) {
    return this.vouchersService.adminListVouchers(query);
  }

  @Post('issue')
  @RequirePermissions(AppModule.REWARDS, PermissionAction.CREATE)
  @ResponseMessage('Voucher issued successfully')
  issue(@Body() dto: AdminIssueVoucherDto, @CurrentUser() user: JwtPayload) {
    return this.vouchersService.adminIssueVoucher(dto, user.sub);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(AppModule.REWARDS, PermissionAction.EDIT)
  @ResponseMessage('Voucher cancelled successfully')
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelVoucherDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.vouchersService.cancelVoucher(id, dto.reason, user.sub);
  }
}
