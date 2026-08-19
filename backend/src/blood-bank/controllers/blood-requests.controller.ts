import {
  BadRequestException,
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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { blood_group, urgency_level } from '../../../generated/prisma/client';
import { AppModule, JwtPayload, PermissionAction, UserRole } from '../../common/constants';
import { CurrentUser, RequirePermissions, ResponseMessage, Roles } from '../../common/decorators';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { buildUploadedFilePath, createImageUploadOptions } from '../../common/utils/image-upload.util';
import {
  AdminCreateBloodRequestDto,
  AdminUpdateBloodRequestDto,
  CreateBloodRequestDto,
  ListBloodRequestsQueryDto,
} from '../dto/blood-request.dto';
import { BloodRequestsService } from '../services/blood-requests.service';

const BLOOD_REQUEST_BODY_SCHEMA = {
  type: 'object' as const,
  properties: {
    file: { type: 'string', format: 'binary', description: 'Proof/document showing blood is required (e.g. doctor prescription, hospital admission slip)' },
    patientName: { type: 'string' },
    bloodGroup: { type: 'string', enum: Object.values(blood_group) },
    unitsRequired: { type: 'number', example: 2 },
    urgency: { type: 'string', enum: Object.values(urgency_level) },
    hospitalName: { type: 'string' },
    hospitalAddress: { type: 'string' },
    city: { type: 'string' },
    state: { type: 'string' },
    contactName: { type: 'string' },
    contactMobile: { type: 'string' },
    requiredByDate: { type: 'string', format: 'date', example: '2026-08-15' },
    notes: { type: 'string' },
    isEmergency: { type: 'boolean', example: false },
  },
  required: ['file', 'patientName', 'bloodGroup', 'hospitalName', 'hospitalAddress', 'city', 'state', 'contactName', 'contactMobile', 'requiredByDate'],
};

@ApiTags('Blood Requests')
@ApiBearerAuth()
@Controller('blood-requests')
export class BloodRequestsController {
  constructor(private readonly bloodRequestsService: BloodRequestsService) {}

  @Post()
  @ResponseMessage('Blood request submitted successfully')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: BLOOD_REQUEST_BODY_SCHEMA })
  @UseInterceptors(FileInterceptor('file', createImageUploadOptions('blood-requests')))
  create(@CurrentUser() user: JwtPayload, @UploadedFile() file: Express.Multer.File, @Body() dto: CreateBloodRequestDto) {
    if (!file) {
      throw new BadRequestException('A supporting proof/document is required');
    }
    return this.bloodRequestsService.createRequest(user.sub, dto, buildUploadedFilePath('blood-requests', file.filename));
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
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      ...BLOOD_REQUEST_BODY_SCHEMA,
      properties: { ...BLOOD_REQUEST_BODY_SCHEMA.properties, userId: { type: 'string', format: 'uuid' } },
      required: ['userId', ...BLOOD_REQUEST_BODY_SCHEMA.required.filter((field) => field !== 'file')],
    },
  })
  @UseInterceptors(FileInterceptor('file', createImageUploadOptions('blood-requests')))
  create(@UploadedFile() file: Express.Multer.File, @Body() dto: AdminCreateBloodRequestDto) {
    return this.bloodRequestsService.adminCreateRequest(
      dto,
      file ? buildUploadedFilePath('blood-requests', file.filename) : undefined,
    );
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
