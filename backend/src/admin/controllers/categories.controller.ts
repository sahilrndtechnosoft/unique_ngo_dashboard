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
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  AppModule,
  PermissionAction,
  UserRole,
} from '../../common/constants';
import {
  Public,
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
import {
  CreateCategoryDto,
  ListCategoriesQueryDto,
  UpdateCategoryDto,
} from '../dto/category.dto';
import { CategoriesService } from '../services/categories.service';

@ApiTags('Admin - Categories')
@ApiBearerAuth()
@Controller('admin/categories')
@UseGuards(RolesGuard, PermissionsGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminCategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @RequirePermissions(AppModule.PRODUCTS, PermissionAction.VIEW)
  @ResponseMessage('Categories fetched successfully')
  @ApiOperation({ summary: 'List product categories' })
  list(@Query() query: ListCategoriesQueryDto) {
    return this.categoriesService.listCategories(query);
  }

  @Get(':id')
  @RequirePermissions(AppModule.PRODUCTS, PermissionAction.VIEW)
  @ResponseMessage('Category fetched successfully')
  get(@Param('id') id: string) {
    return this.categoriesService.getCategory(id);
  }

  @Post()
  @RequirePermissions(AppModule.PRODUCTS, PermissionAction.CREATE)
  @ResponseMessage('Category created successfully')
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.createCategory(dto);
  }

  @Patch(':id')
  @RequirePermissions(AppModule.PRODUCTS, PermissionAction.EDIT)
  @ResponseMessage('Category updated successfully')
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.updateCategory(id, dto);
  }

  @Post(':id/image')
  @RequirePermissions(AppModule.PRODUCTS, PermissionAction.EDIT)
  @ResponseMessage('Category image uploaded successfully')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', createImageUploadOptions('categories')),
  )
  async uploadImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Category image file is required');
    }
    return this.categoriesService.updateCategoryImage(
      id,
      buildUploadedFilePath('categories', file.filename),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(AppModule.PRODUCTS, PermissionAction.DELETE)
  @ResponseMessage('Category deleted successfully')
  delete(@Param('id') id: string) {
    return this.categoriesService.deleteCategory(id);
  }
}

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Public()
  @Get()
  @ResponseMessage('Active categories fetched successfully')
  @ApiOperation({ summary: 'List active categories for sellers/apps' })
  listActive(@Query() query: ListCategoriesQueryDto) {
    return this.categoriesService.listCategories(query, true);
  }
}
