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
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppModule, JwtPayload, PermissionAction, UserRole } from '../../common/constants';
import { CurrentUser, Public, RequirePermissions, ResponseMessage, Roles } from '../../common/decorators';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { buildUploadedFilePath, createImageUploadOptions } from '../../common/utils/image-upload.util';
import { CreateCampaignDto, ListCampaignsQueryDto, UpdateCampaignDto } from '../dto/campaign.dto';
import { CampaignsService } from '../services/campaigns.service';

@ApiTags('Admin - Blood Campaigns')
@ApiBearerAuth()
@Controller('admin/campaigns')
@UseGuards(RolesGuard, PermissionsGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminCampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get()
  @RequirePermissions(AppModule.BLOOD_BANK, PermissionAction.VIEW)
  @ResponseMessage('Campaigns fetched successfully')
  list(@Query() query: ListCampaignsQueryDto) {
    return this.campaignsService.listCampaigns(query);
  }

  @Get(':id')
  @RequirePermissions(AppModule.BLOOD_BANK, PermissionAction.VIEW)
  @ResponseMessage('Campaign fetched successfully')
  get(@Param('id') id: string) {
    return this.campaignsService.getCampaign(id);
  }

  @Post()
  @RequirePermissions(AppModule.BLOOD_BANK, PermissionAction.CREATE)
  @ResponseMessage('Campaign created successfully')
  create(@Body() dto: CreateCampaignDto, @CurrentUser() user: JwtPayload) {
    return this.campaignsService.createCampaign(dto, user.sub);
  }

  @Patch(':id')
  @RequirePermissions(AppModule.BLOOD_BANK, PermissionAction.EDIT)
  @ResponseMessage('Campaign updated successfully')
  update(@Param('id') id: string, @Body() dto: UpdateCampaignDto) {
    return this.campaignsService.updateCampaign(id, dto);
  }

  @Post(':id/banner')
  @RequirePermissions(AppModule.BLOOD_BANK, PermissionAction.EDIT)
  @ResponseMessage('Campaign banner uploaded successfully')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } }, required: ['file'] },
  })
  @UseInterceptors(FileInterceptor('file', createImageUploadOptions('campaigns')))
  async uploadBanner(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Campaign banner image file is required');
    }
    return this.campaignsService.updateCampaignBanner(id, buildUploadedFilePath('campaigns', file.filename));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(AppModule.BLOOD_BANK, PermissionAction.DELETE)
  @ResponseMessage('Campaign deleted successfully')
  delete(@Param('id') id: string) {
    return this.campaignsService.deleteCampaign(id);
  }
}

@ApiTags('Blood Campaigns')
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Public()
  @Get()
  @ResponseMessage('Active campaigns fetched successfully')
  @ApiOperation({ summary: 'List active blood campaigns for donor booking' })
  listActive(@Query() query: ListCampaignsQueryDto) {
    return this.campaignsService.listCampaigns(query, true);
  }

  @Public()
  @Get(':id')
  @ResponseMessage('Campaign fetched successfully')
  get(@Param('id') id: string) {
    return this.campaignsService.getCampaign(id);
  }
}
