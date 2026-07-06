import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UploadedFile,
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
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  JwtPayload,
  MAX_PROFILE_PICTURE_SIZE,
} from '../common/constants';
import { CurrentUser, ResponseMessage } from '../common/decorators';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateSellerProfileDto } from './dto/update-seller-profile.dto';
import { UsersService } from './users.service';
import { RbacService } from '../admin/services/rbac.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly rbacService: RbacService,
  ) {}

  @Get('me/permissions')
  @ResponseMessage('Permissions fetched successfully')
  @ApiOperation({ summary: 'Get current user module permissions for admin UI' })
  getMyPermissions(@CurrentUser() user: JwtPayload) {
    return this.rbacService.getUserPermissionsSummary(user.sub, user.role);
  }

  @Get('me')
  @ResponseMessage('Profile fetched successfully')
  @ApiOperation({ summary: 'Get authenticated user profile' })
  getProfile(@CurrentUser() user: JwtPayload) {
    return this.usersService.getProfile(user.sub);
  }

  @Patch('me')
  @ResponseMessage('Profile updated successfully')
  @ApiOperation({
    summary: 'Update profile (name, email, password, address, bio, etc.)',
  })
  updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.sub, dto);
  }

  @Post('me/profile-picture')
  @ResponseMessage('Profile picture uploaded successfully')
  @ApiOperation({ summary: 'Upload profile picture' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_PROFILE_PICTURE_SIZE },
      fileFilter: (_req, file, callback) => {
        if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype)) {
          return callback(
            new BadRequestException(
              'Only JPEG, PNG, WEBP, and GIF images are allowed',
            ),
            false,
          );
        }
        callback(null, true);
      },
      storage: diskStorage({
        destination: (_req, _file, callback) => {
          const uploadDir = join(process.cwd(), 'uploads', 'profile-pictures');
          if (!existsSync(uploadDir)) {
            mkdirSync(uploadDir, { recursive: true });
          }
          callback(null, uploadDir);
        },
        filename: (_req, file, callback) => {
          const extension = extname(file.originalname).toLowerCase() || '.jpg';
          callback(null, `${randomUUID()}${extension}`);
        },
      }),
    }),
  )
  async uploadProfilePicture(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Profile picture file is required');
    }

    const appUrl = this.configService.get<string>('app.appUrl')!;
    const fileUrl = `${appUrl}/uploads/profile-pictures/${file.filename}`;
    const profile = await this.usersService.updateProfilePicture(
      user.sub,
      fileUrl,
    );

    return { profilePicture: profile.profilePicture };
  }

  @Get('me/seller-profile')
  @ResponseMessage('Seller profile fetched successfully')
  @ApiOperation({ summary: 'Get seller business profile' })
  getSellerProfile(@CurrentUser() user: JwtPayload) {
    return this.usersService.getSellerProfile(user.sub, user.role);
  }

  @Patch('me/seller-profile')
  @ResponseMessage('Seller profile updated successfully')
  @ApiOperation({ summary: 'Update seller business profile' })
  updateSellerProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateSellerProfileDto,
  ) {
    return this.usersService.updateSellerProfile(user.sub, user.role, dto);
  }
}
