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
import { blood_group } from '../../../generated/prisma/client';
import { AppModule, JwtPayload, PermissionAction, UserRole } from '../../common/constants';
import { CurrentUser, RequirePermissions, ResponseMessage, Roles } from '../../common/decorators';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { buildUploadedFilePath, createImageUploadOptions, deleteUploadedFile } from '../../common/utils/image-upload.util';
import {
  AdminCreateDonationDto,
  AdminUpdateDonationDto,
  CreateDonationDto,
  ListDonationsQueryDto,
  UpdateDonationDto,
  UpdateDonationStatusDto,
} from '../dto/donation.dto';
import { DonationsService } from '../services/donations.service';

@ApiTags('Blood Donations')
@ApiBearerAuth()
@Controller('donations')
export class DonationsController {
  constructor(private readonly donationsService: DonationsService) {}

  @Post()
  @ResponseMessage('Donation submitted for review')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'Donation certificate / proof image' },
        bloodGroup: { type: 'string', enum: Object.values(blood_group) },
        donationDate: { type: 'string', format: 'date', example: '2026-08-10' },
        hospitalId: { type: 'string', format: 'uuid' },
        campaignId: { type: 'string', format: 'uuid' },
        appointmentId: { type: 'string', format: 'uuid' },
        unitsDonated: { type: 'number', example: 1 },
        donationCenter: { type: 'string' },
        hospitalName: { type: 'string' },
        city: { type: 'string' },
        state: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['file', 'bloodGroup', 'donationDate'],
    },
  })
  @UseInterceptors(FileInterceptor('file', createImageUploadOptions('donations')))
  async submit(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateDonationDto,
  ) {
    if (!file) {
      throw new BadRequestException('A proof/certificate image is required');
    }
    try {
      return await this.donationsService.submitDonation(user.sub, dto, buildUploadedFilePath('donations', file.filename));
    } catch (err) {
      deleteUploadedFile(buildUploadedFilePath('donations', file.filename));
      throw err;
    }
  }

  @Get()
  @ResponseMessage('Donations fetched successfully')
  list(@CurrentUser() user: JwtPayload, @Query() query: ListDonationsQueryDto) {
    return this.donationsService.listMyDonations(user.sub, query);
  }

  @Get(':id')
  @ResponseMessage('Donation fetched successfully')
  get(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.donationsService.getMyDonation(user.sub, id);
  }

  @Patch(':id')
  @ResponseMessage('Donation updated successfully')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'Donation certificate / proof image (optional to replace)' },
        bloodGroup: { type: 'string', enum: Object.values(blood_group) },
        donationDate: { type: 'string', format: 'date', example: '2026-08-10' },
        hospitalId: { type: 'string', format: 'uuid' },
        campaignId: { type: 'string', format: 'uuid' },
        appointmentId: { type: 'string', format: 'uuid' },
        unitsDonated: { type: 'number', example: 1 },
        donationCenter: { type: 'string' },
        hospitalName: { type: 'string' },
        city: { type: 'string' },
        state: { type: 'string' },
        notes: { type: 'string' },
        hasConsentForm: { type: 'boolean' },
        forSelf: { type: 'boolean' },
        beneficiaryName: { type: 'string' },
        beneficiaryMobile: { type: 'string' },
        beneficiaryRelation: { type: 'string' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', createImageUploadOptions('donations')))
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UpdateDonationDto,
  ) {
    try {
      return await this.donationsService.updateMyDonation(
        user.sub,
        id,
        dto,
        file ? buildUploadedFilePath('donations', file.filename) : undefined,
      );
    } catch (err) {
      if (file) {
        deleteUploadedFile(buildUploadedFilePath('donations', file.filename));
      }
      throw err;
    }
  }
}

@ApiTags('Admin - Blood Donations')
@ApiBearerAuth()
@Controller('admin/donations')
@UseGuards(RolesGuard, PermissionsGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminDonationsController {
  constructor(private readonly donationsService: DonationsService) {}

  @Get()
  @RequirePermissions(AppModule.BLOOD_BANK, PermissionAction.VIEW)
  @ResponseMessage('Donations fetched successfully')
  list(@Query() query: ListDonationsQueryDto) {
    return this.donationsService.listDonations(query);
  }

  @Get(':id')
  @RequirePermissions(AppModule.BLOOD_BANK, PermissionAction.VIEW)
  @ResponseMessage('Donation fetched successfully')
  get(@Param('id') id: string) {
    return this.donationsService.getDonation(id);
  }

  @Post()
  @RequirePermissions(AppModule.BLOOD_BANK, PermissionAction.CREATE)
  @ResponseMessage('Donation created successfully')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'Donation certificate / proof image (optional)' },
        userId: { type: 'string', format: 'uuid' },
        bloodGroup: { type: 'string', enum: Object.values(blood_group) },
        donationDate: { type: 'string', format: 'date', example: '2026-08-10' },
        hospitalId: { type: 'string', format: 'uuid' },
        campaignId: { type: 'string', format: 'uuid' },
        unitsDonated: { type: 'number', example: 1 },
        donationCenter: { type: 'string' },
        hospitalName: { type: 'string' },
        city: { type: 'string' },
        state: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['userId', 'bloodGroup', 'donationDate'],
    },
  })
  @UseInterceptors(FileInterceptor('file', createImageUploadOptions('donations')))
  async create(@UploadedFile() file: Express.Multer.File | undefined, @Body() dto: AdminCreateDonationDto) {
    try {
      return await this.donationsService.adminCreateDonation(
        dto,
        file ? buildUploadedFilePath('donations', file.filename) : undefined,
      );
    } catch (err) {
      if (file) {
        deleteUploadedFile(buildUploadedFilePath('donations', file.filename));
      }
      throw err;
    }
  }

  @Patch(':id')
  @RequirePermissions(AppModule.BLOOD_BANK, PermissionAction.EDIT)
  @ResponseMessage('Donation updated successfully')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'Donation certificate / proof image (optional replacement)' },
        bloodGroup: { type: 'string', enum: Object.values(blood_group) },
        donationDate: { type: 'string', format: 'date', example: '2026-08-10' },
        hospitalId: { type: 'string', format: 'uuid' },
        campaignId: { type: 'string', format: 'uuid' },
        unitsDonated: { type: 'number', example: 1 },
        donationCenter: { type: 'string' },
        hospitalName: { type: 'string' },
        city: { type: 'string' },
        state: { type: 'string' },
        notes: { type: 'string' },
        hasConsentForm: { type: 'boolean' },
        forSelf: { type: 'boolean' },
        beneficiaryName: { type: 'string' },
        beneficiaryMobile: { type: 'string' },
        beneficiaryRelation: { type: 'string' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', createImageUploadOptions('donations')))
  async update(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: AdminUpdateDonationDto,
  ) {
    try {
      return await this.donationsService.adminUpdateDonation(
        id,
        dto,
        file ? buildUploadedFilePath('donations', file.filename) : undefined,
      );
    } catch (err) {
      if (file) {
        deleteUploadedFile(buildUploadedFilePath('donations', file.filename));
      }
      throw err;
    }
  }

  @Patch(':id/status')
  @RequirePermissions(AppModule.BLOOD_BANK, PermissionAction.EDIT)
  @ResponseMessage('Donation reviewed successfully')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateDonationStatusDto, @CurrentUser() user: JwtPayload) {
    return this.donationsService.updateStatus(id, dto, user.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(AppModule.BLOOD_BANK, PermissionAction.DELETE)
  @ResponseMessage('Donation deleted successfully')
  delete(@Param('id') id: string) {
    return this.donationsService.adminDeleteDonation(id);
  }
}
