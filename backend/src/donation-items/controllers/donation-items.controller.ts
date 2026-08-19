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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { AppModule, JwtPayload, PermissionAction, UserRole } from '../../common/constants';
import { CurrentUser, RequirePermissions, ResponseMessage, Roles } from '../../common/decorators';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { buildUploadedFilePath, createImageUploadOptions } from '../../common/utils/image-upload.util';
import {
  AdminListDonationItemsQueryDto,
  AdminUpdateDonationItemDto,
  CreateDonationItemDto,
  ListDonationItemsQueryDto,
  RejectDonationItemDto,
  UpdateDonationItemDto,
} from '../dto/donation-item.dto';
import { DonationItemsService } from '../services/donation-items.service';

const IMAGE_BODY_SCHEMA = {
  type: 'object' as const,
  properties: {
    file: { type: 'string', format: 'binary' },
    isPrimary: { type: 'boolean' },
  },
  required: ['file'],
};

@ApiTags('Donation Items')
@ApiBearerAuth()
@Controller('donation-items')
export class DonationItemsController {
  constructor(private readonly donationItemsService: DonationItemsService) {}

  @Post()
  @ResponseMessage('Donation item submitted successfully')
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateDonationItemDto) {
    return this.donationItemsService.create(user.sub, dto);
  }

  @Get()
  @ResponseMessage('Donation items fetched successfully')
  list(@Query() query: ListDonationItemsQueryDto) {
    return this.donationItemsService.listPublic(query);
  }

  @Get('mine')
  @ResponseMessage('Your donation items fetched successfully')
  listMine(@CurrentUser() user: JwtPayload, @Query() query: ListDonationItemsQueryDto) {
    return this.donationItemsService.listMine(user.sub, query);
  }

  @Get(':id')
  @ResponseMessage('Donation item fetched successfully')
  get(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.donationItemsService.getPublic(id, user.sub);
  }

  @Patch(':id')
  @ResponseMessage('Donation item updated successfully')
  update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateDonationItemDto) {
    return this.donationItemsService.update(user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Donation item cancelled successfully')
  cancel(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.donationItemsService.cancel(user.sub, id);
  }

  @Post(':id/images')
  @ResponseMessage('Image uploaded successfully')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: IMAGE_BODY_SCHEMA })
  @UseInterceptors(FileInterceptor('file', createImageUploadOptions('donation-items')))
  addImage(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('isPrimary') isPrimary?: string,
  ) {
    return this.donationItemsService.addImage(user.sub, id, buildUploadedFilePath('donation-items', file.filename), isPrimary === 'true');
  }

  @Delete(':id/images/:imageId')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Image removed successfully')
  removeImage(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Param('imageId') imageId: string) {
    return this.donationItemsService.removeImage(user.sub, id, imageId);
  }
}

@ApiTags('Admin - Donation Items')
@ApiBearerAuth()
@Controller('admin/donation-items')
@UseGuards(RolesGuard, PermissionsGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminDonationItemsController {
  constructor(private readonly donationItemsService: DonationItemsService) {}

  @Get()
  @RequirePermissions(AppModule.DONATIONS, PermissionAction.VIEW)
  @ResponseMessage('Donation items fetched successfully')
  list(@Query() query: AdminListDonationItemsQueryDto) {
    return this.donationItemsService.adminList(query);
  }

  @Get(':id')
  @RequirePermissions(AppModule.DONATIONS, PermissionAction.VIEW)
  @ResponseMessage('Donation item fetched successfully')
  get(@Param('id') id: string) {
    return this.donationItemsService.adminGet(id);
  }

  @Patch(':id')
  @RequirePermissions(AppModule.DONATIONS, PermissionAction.EDIT)
  @ResponseMessage('Donation item updated successfully')
  update(@Param('id') id: string, @Body() dto: AdminUpdateDonationItemDto) {
    return this.donationItemsService.adminUpdate(id, dto);
  }

  @Patch(':id/verify')
  @RequirePermissions(AppModule.DONATIONS, PermissionAction.EDIT)
  @ResponseMessage('Donation item approved successfully')
  verify(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.donationItemsService.verify(id, user.sub);
  }

  @Patch(':id/reject')
  @RequirePermissions(AppModule.DONATIONS, PermissionAction.EDIT)
  @ResponseMessage('Donation item rejected')
  reject(@Param('id') id: string, @Body() dto: RejectDonationItemDto, @CurrentUser() user: JwtPayload) {
    return this.donationItemsService.reject(id, dto, user.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(AppModule.DONATIONS, PermissionAction.DELETE)
  @ResponseMessage('Donation item deleted successfully')
  delete(@Param('id') id: string) {
    return this.donationItemsService.adminDelete(id);
  }

  @Post(':id/images')
  @RequirePermissions(AppModule.DONATIONS, PermissionAction.EDIT)
  @ResponseMessage('Image uploaded successfully')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: IMAGE_BODY_SCHEMA })
  @UseInterceptors(FileInterceptor('file', createImageUploadOptions('donation-items')))
  addImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('isPrimary') isPrimary?: string,
  ) {
    return this.donationItemsService.addImage(undefined, id, buildUploadedFilePath('donation-items', file.filename), isPrimary === 'true');
  }

  @Delete(':id/images/:imageId')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(AppModule.DONATIONS, PermissionAction.EDIT)
  @ResponseMessage('Image removed successfully')
  removeImage(@Param('id') id: string, @Param('imageId') imageId: string) {
    return this.donationItemsService.removeImage(undefined, id, imageId);
  }
}
