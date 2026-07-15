import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
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
  buildUploadedFilePath,
  createImageUploadOptions,
} from '../../common/utils/image-upload.util';
import { UpdateAppSettingsDto } from '../dto/update-app-settings.dto';
import { AppSettingsService } from '../services/app-settings.service';

@ApiTags('Admin - Settings')
@ApiBearerAuth()
@Controller('admin/settings')
@UseGuards(RolesGuard, PermissionsGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AppSettingsController {
  constructor(private readonly appSettingsService: AppSettingsService) {}

  @Get()
  @RequirePermissions(AppModule.SETTINGS, PermissionAction.VIEW)
  @ResponseMessage('Settings fetched successfully')
  @ApiOperation({ summary: 'Get company settings, logo, and footer details' })
  getSettings() {
    return this.appSettingsService.getSettings();
  }

  @Patch()
  @RequirePermissions(AppModule.SETTINGS, PermissionAction.EDIT)
  @ResponseMessage('Settings updated successfully')
  @ApiOperation({ summary: 'Update company details and footer content' })
  updateSettings(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateAppSettingsDto,
  ) {
    return this.appSettingsService.updateSettings(dto, user.sub);
  }

  @Post('logo')
  @RequirePermissions(AppModule.SETTINGS, PermissionAction.EDIT)
  @ResponseMessage('Logo uploaded successfully')
  @ApiOperation({ summary: 'Upload company logo' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(FileInterceptor('file', createImageUploadOptions('logo')))
  async uploadLogo(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Logo file is required');
    }

    return this.appSettingsService.updateLogo(
      buildUploadedFilePath('logo', file.filename),
      user.sub,
    );
  }

  @Post('favicon')
  @RequirePermissions(AppModule.SETTINGS, PermissionAction.EDIT)
  @ResponseMessage('Favicon uploaded successfully')
  @ApiOperation({ summary: 'Upload favicon' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(FileInterceptor('file', createImageUploadOptions('favicon')))
  async uploadFavicon(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Favicon file is required');
    }

    return this.appSettingsService.updateFavicon(
      buildUploadedFilePath('favicon', file.filename),
      user.sub,
    );
  }
}
