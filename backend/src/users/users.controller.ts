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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { ConfigService } from '@nestjs/config';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  getAssignableRoles,
  getPermissionsForRole,
  JwtPayload,
  MAX_PROFILE_PICTURE_SIZE,
} from '../common/constants';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions, ResponseMessage } from '../common/decorators';
import { Permission } from '../common/constants';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  @Get('me/permissions')
  @ResponseMessage('Permissions fetched successfully')
  @ApiOperation({ summary: 'Get current user permissions for UI' })
  getMyPermissions(@CurrentUser() user: JwtPayload) {
    return {
      role: user.role,
      permissions: getPermissionsForRole(user.role),
      assignableRoles: getAssignableRoles(user.role),
    };
  }

  @Get('me')
  @ResponseMessage('Profile fetched successfully')
  @ApiOperation({ summary: 'Get authenticated user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile returned',
    schema: {
      example: {
        success: true,
        message: 'Profile fetched successfully',
        data: {
          id: 'uuid',
          fullName: 'John Doe',
          email: 'user@example.com',
          mobile: '9876543210',
        },
      },
    },
  })
  getProfile(@CurrentUser() user: JwtPayload) {
    return this.usersService.getProfile(user.sub);
  }

  @Patch('me')
  @ResponseMessage('Profile updated successfully')
  @ApiOperation({ summary: 'Update authenticated user profile' })
  @ApiResponse({
    status: 200,
    description: 'Profile updated',
    schema: {
      example: {
        success: true,
        message: 'Profile updated successfully',
        data: { id: 'uuid', fullName: 'John Doe' },
      },
    },
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
  @ApiResponse({
    status: 200,
    description: 'Profile picture uploaded',
    schema: {
      example: {
        success: true,
        message: 'Profile picture uploaded successfully',
        data: {
          profilePicture: 'http://localhost:3000/uploads/profile-pictures/uuid.jpg',
        },
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

    return {
      profilePicture: profile.profilePicture,
    };
  }

  @Get('admin/health')
  @Permissions(Permission.USERS_READ)
  @ResponseMessage('Admin access verified')
  @ApiOperation({ summary: 'Admin-only endpoint (RBAC demo)' })
  @ApiResponse({ status: 200, description: 'Admin access granted' })
  adminHealthCheck(@CurrentUser() user: JwtPayload) {
    return { adminId: user.sub, role: user.role };
  }
}
