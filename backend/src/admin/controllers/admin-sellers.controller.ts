import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AppModule,
  JwtPayload,
  PermissionAction,
  UserRole,
} from '../../common/constants';
import {
  CurrentUser,
  RequirePermissions,
  ResponseMessage,
  Roles,
} from '../../common/decorators';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  CreateAdminSellerDto,
  ListSellersQueryDto,
  UpdateAdminSellerDto,
} from '../dto/admin-seller.dto';
import { AdminSellersService } from '../services/admin-sellers.service';

@ApiTags('Admin - Sellers')
@ApiBearerAuth()
@Controller('admin/sellers')
@UseGuards(RolesGuard, PermissionsGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminSellersController {
  constructor(private readonly adminSellersService: AdminSellersService) {}

  @Get()
  @RequirePermissions(AppModule.SELLERS, PermissionAction.VIEW)
  @ResponseMessage('Sellers fetched successfully')
  @ApiOperation({ summary: 'List sellers with filters and pagination' })
  listSellers(@Query() query: ListSellersQueryDto) {
    return this.adminSellersService.listSellers(query);
  }

  @Get(':id')
  @RequirePermissions(AppModule.SELLERS, PermissionAction.VIEW)
  @ResponseMessage('Seller fetched successfully')
  @ApiOperation({ summary: 'Get seller by ID' })
  getSeller(@Param('id') id: string) {
    return this.adminSellersService.getSeller(id);
  }

  @Post()
  @RequirePermissions(AppModule.SELLERS, PermissionAction.CREATE)
  @ResponseMessage('Seller created successfully')
  @ApiOperation({ summary: 'Create seller user + profile' })
  createSeller(
    @Body() dto: CreateAdminSellerDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.adminSellersService.createSeller(dto, actor.sub);
  }

  @Patch(':id')
  @RequirePermissions(AppModule.SELLERS, PermissionAction.EDIT)
  @ResponseMessage('Seller updated successfully')
  @ApiOperation({ summary: 'Update seller (including approve/reject/suspend)' })
  updateSeller(
    @Param('id') id: string,
    @Body() dto: UpdateAdminSellerDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.adminSellersService.updateSeller(id, dto, actor.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(AppModule.SELLERS, PermissionAction.DELETE)
  @ResponseMessage('Seller deleted successfully')
  @ApiOperation({ summary: 'Soft-delete seller profile and user' })
  deleteSeller(@Param('id') id: string) {
    return this.adminSellersService.deleteSeller(id);
  }
}
