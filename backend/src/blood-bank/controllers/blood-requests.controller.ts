import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AppModule, JwtPayload, PermissionAction, UserRole } from '../../common/constants';
import { CurrentUser, RequirePermissions, ResponseMessage, Roles } from '../../common/decorators';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  AdminCreateBloodRequestDto,
  AdminUpdateBloodRequestDto,
  CreateBloodRequestDto,
  ListBloodRequestsQueryDto,
} from '../dto/blood-request.dto';
import { BloodRequestsService } from '../services/blood-requests.service';

@ApiTags('Blood Requests')
@ApiBearerAuth()
@Controller('blood-requests')
export class BloodRequestsController {
  constructor(private readonly bloodRequestsService: BloodRequestsService) {}

  @Post()
  @ResponseMessage('Blood request submitted successfully')
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateBloodRequestDto) {
    return this.bloodRequestsService.createRequest(user.sub, dto);
  }

  @Get()
  @ResponseMessage('Blood requests fetched successfully')
  list(@CurrentUser() user: JwtPayload, @Query() query: ListBloodRequestsQueryDto) {
    return this.bloodRequestsService.listMyRequests(user.sub, query);
  }

  @Get(':id')
  @ResponseMessage('Blood request fetched successfully')
  get(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.bloodRequestsService.getMyRequest(user.sub, id);
  }

  @Patch(':id/cancel')
  @ResponseMessage('Blood request cancelled successfully')
  cancel(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.bloodRequestsService.cancelRequest(user.sub, id);
  }
}

@ApiTags('Admin - Blood Requests')
@ApiBearerAuth()
@Controller('admin/blood-requests')
@UseGuards(RolesGuard, PermissionsGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminBloodRequestsController {
  constructor(private readonly bloodRequestsService: BloodRequestsService) {}

  @Get()
  @RequirePermissions(AppModule.BLOOD_BANK, PermissionAction.VIEW)
  @ResponseMessage('Blood requests fetched successfully')
  list(@Query() query: ListBloodRequestsQueryDto) {
    return this.bloodRequestsService.listRequests(query);
  }

  @Get(':id')
  @RequirePermissions(AppModule.BLOOD_BANK, PermissionAction.VIEW)
  @ResponseMessage('Blood request fetched successfully')
  get(@Param('id') id: string) {
    return this.bloodRequestsService.getRequest(id);
  }

  @Post()
  @RequirePermissions(AppModule.BLOOD_BANK, PermissionAction.CREATE)
  @ResponseMessage('Blood request created successfully')
  create(@Body() dto: AdminCreateBloodRequestDto) {
    return this.bloodRequestsService.adminCreateRequest(dto);
  }

  @Patch(':id')
  @RequirePermissions(AppModule.BLOOD_BANK, PermissionAction.EDIT)
  @ResponseMessage('Blood request updated successfully')
  update(@Param('id') id: string, @Body() dto: AdminUpdateBloodRequestDto, @CurrentUser() user: JwtPayload) {
    return this.bloodRequestsService.adminUpdateRequest(id, dto, user.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(AppModule.BLOOD_BANK, PermissionAction.DELETE)
  @ResponseMessage('Blood request deleted successfully')
  delete(@Param('id') id: string) {
    return this.bloodRequestsService.adminDeleteRequest(id);
  }
}
