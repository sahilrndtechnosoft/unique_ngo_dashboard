import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AppModule, JwtPayload, PermissionAction, UserRole } from '../../common/constants';
import { CurrentUser, RequirePermissions, ResponseMessage, Roles } from '../../common/decorators';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  AdminListDonationItemRequestsQueryDto,
  AdminUpdateDonationItemRequestDto,
  CreateDonationItemRequestDto,
  ListDonationItemRequestsQueryDto,
  RespondDonationItemRequestDto,
} from '../dto/donation-item-request.dto';
import { DonationItemRequestsService } from '../services/donation-item-requests.service';

@ApiTags('Donation Item Requests')
@ApiBearerAuth()
@Controller('donation-item-requests')
export class DonationItemRequestsController {
  constructor(private readonly requestsService: DonationItemRequestsService) {}

  @Post()
  @ResponseMessage('Request submitted successfully')
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateDonationItemRequestDto) {
    return this.requestsService.create(user.sub, dto);
  }

  @Get('mine')
  @ResponseMessage('Your requests fetched successfully')
  listMine(@CurrentUser() user: JwtPayload, @Query() query: ListDonationItemRequestsQueryDto) {
    return this.requestsService.listMine(user.sub, query);
  }

  @Get('for-my-items')
  @ResponseMessage('Requests for your items fetched successfully')
  listForMyItems(@CurrentUser() user: JwtPayload, @Query() query: ListDonationItemRequestsQueryDto) {
    return this.requestsService.listForMyItems(user.sub, query);
  }

  @Patch(':id/respond')
  @ResponseMessage('Request updated successfully')
  respond(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: RespondDonationItemRequestDto) {
    return this.requestsService.respond(user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Request cancelled successfully')
  cancel(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.requestsService.cancel(user.sub, id);
  }
}

@ApiTags('Admin - Donation Item Requests')
@ApiBearerAuth()
@Controller('admin/donation-item-requests')
@UseGuards(RolesGuard, PermissionsGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminDonationItemRequestsController {
  constructor(private readonly requestsService: DonationItemRequestsService) {}

  @Get()
  @RequirePermissions(AppModule.DONATIONS, PermissionAction.VIEW)
  @ResponseMessage('Requests fetched successfully')
  list(@Query() query: AdminListDonationItemRequestsQueryDto) {
    return this.requestsService.adminList(query);
  }

  @Get(':id')
  @RequirePermissions(AppModule.DONATIONS, PermissionAction.VIEW)
  @ResponseMessage('Request fetched successfully')
  get(@Param('id') id: string) {
    return this.requestsService.adminGet(id);
  }

  @Patch(':id')
  @RequirePermissions(AppModule.DONATIONS, PermissionAction.EDIT)
  @ResponseMessage('Request updated successfully')
  update(@Param('id') id: string, @Body() dto: AdminUpdateDonationItemRequestDto, @CurrentUser() user: JwtPayload) {
    return this.requestsService.adminUpdate(id, dto, user.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(AppModule.DONATIONS, PermissionAction.DELETE)
  @ResponseMessage('Request deleted successfully')
  delete(@Param('id') id: string) {
    return this.requestsService.adminDelete(id);
  }
}
