import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AppModule, JwtPayload, PermissionAction, UserRole } from '../../common/constants';
import { CurrentUser, Public, RequirePermissions, ResponseMessage, Roles } from '../../common/decorators';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateInquiryDto, ListInquiriesQueryDto, UpdateInquiryDto } from '../dto/inquiry.dto';
import { InquiriesService } from '../services/inquiries.service';

@ApiTags('Inquiries')
@Controller('public/inquiries')
@Public()
export class InquiriesController {
  constructor(private readonly inquiriesService: InquiriesService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ResponseMessage('Inquiry submitted successfully')
  @ApiOperation({ summary: 'Submit an inquiry from the app' })
  create(@Body() dto: CreateInquiryDto) {
    return this.inquiriesService.create(dto);
  }
}

@ApiTags('Admin - Inquiries')
@ApiBearerAuth()
@Controller('admin/inquiries')
@UseGuards(RolesGuard, PermissionsGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminInquiriesController {
  constructor(private readonly inquiriesService: InquiriesService) {}

  @Get()
  @RequirePermissions(AppModule.INQUIRIES, PermissionAction.VIEW)
  @ResponseMessage('Inquiries fetched successfully')
  list(@Query() query: ListInquiriesQueryDto) {
    return this.inquiriesService.list(query);
  }

  @Get(':id')
  @RequirePermissions(AppModule.INQUIRIES, PermissionAction.VIEW)
  @ResponseMessage('Inquiry fetched successfully')
  get(@Param('id') id: string) {
    return this.inquiriesService.get(id);
  }

  @Patch(':id')
  @RequirePermissions(AppModule.INQUIRIES, PermissionAction.EDIT)
  @ResponseMessage('Inquiry updated successfully')
  update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateInquiryDto) {
    return this.inquiriesService.update(id, dto, user.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(AppModule.INQUIRIES, PermissionAction.DELETE)
  @ResponseMessage('Inquiry deleted successfully')
  remove(@Param('id') id: string) {
    return this.inquiriesService.remove(id);
  }
}
