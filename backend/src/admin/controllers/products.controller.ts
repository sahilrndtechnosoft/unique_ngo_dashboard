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
import {
  CreateProductDto,
  CreateSellerProductDto,
  ListProductsQueryDto,
  RejectProductDto,
  UpdateProductDto,
} from '../dto/product.dto';
import { ProductsService } from '../services/products.service';

@ApiTags('Admin - Products')
@ApiBearerAuth()
@Controller('admin/products')
@UseGuards(RolesGuard, PermissionsGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @RequirePermissions(AppModule.PRODUCTS, PermissionAction.VIEW)
  @ResponseMessage('Products fetched successfully')
  list(@Query() query: ListProductsQueryDto) {
    return this.productsService.listProducts(query);
  }

  @Get(':id')
  @RequirePermissions(AppModule.PRODUCTS, PermissionAction.VIEW)
  @ResponseMessage('Product fetched successfully')
  get(@Param('id') id: string) {
    return this.productsService.getProduct(id);
  }

  @Post()
  @RequirePermissions(AppModule.PRODUCTS, PermissionAction.CREATE)
  @ResponseMessage('Product created successfully')
  create(@Body() dto: CreateProductDto, @CurrentUser() actor: JwtPayload) {
    return this.productsService.createProduct(dto, {
      isAdmin: true,
      actorId: actor.sub,
    });
  }

  @Patch(':id')
  @RequirePermissions(AppModule.PRODUCTS, PermissionAction.EDIT)
  @ResponseMessage('Product updated successfully')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.updateProduct(id, dto, { isAdmin: true });
  }

  @Post(':id/approve')
  @RequirePermissions(AppModule.PRODUCTS, PermissionAction.EDIT)
  @ResponseMessage('Product approved successfully')
  @ApiOperation({ summary: 'Approve PENDING_REVIEW product to ACTIVE' })
  approve(@Param('id') id: string, @CurrentUser() actor: JwtPayload) {
    return this.productsService.approveProduct(id, actor.sub);
  }

  @Post(':id/reject')
  @RequirePermissions(AppModule.PRODUCTS, PermissionAction.EDIT)
  @ResponseMessage('Product rejected successfully')
  reject(
    @Param('id') id: string,
    @Body() dto: RejectProductDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.productsService.rejectProduct(id, dto, actor.sub);
  }

  @Post(':id/images')
  @RequirePermissions(AppModule.PRODUCTS, PermissionAction.EDIT)
  @ResponseMessage('Product image uploaded successfully')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        isPrimary: { type: 'boolean' },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', createImageUploadOptions('products')),
  )
  async uploadImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('isPrimary') isPrimary?: string,
  ) {
    if (!file) {
      throw new BadRequestException('Product image file is required');
    }
    return this.productsService.addProductImage(
      id,
      buildUploadedFilePath('products', file.filename),
      { isPrimary: isPrimary === 'true' || isPrimary === '1' },
    );
  }

  @Delete(':id/images/:imageId')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(AppModule.PRODUCTS, PermissionAction.EDIT)
  @ResponseMessage('Product image deleted successfully')
  deleteImage(@Param('id') id: string, @Param('imageId') imageId: string) {
    return this.productsService.deleteProductImage(id, imageId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(AppModule.PRODUCTS, PermissionAction.DELETE)
  @ResponseMessage('Product deleted successfully')
  delete(@Param('id') id: string) {
    return this.productsService.deleteProduct(id);
  }
}

@ApiTags('Seller - Products')
@ApiBearerAuth()
@Controller('seller/products')
@UseGuards(RolesGuard)
@Roles(UserRole.SELLER)
export class SellerProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ResponseMessage('Seller products fetched successfully')
  async list(
    @Query() query: ListProductsQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const sellerId = await this.productsService.resolveSellerProfileId(user.sub);
    return this.productsService.listProducts(query, { sellerId });
  }

  @Get(':id')
  @ResponseMessage('Product fetched successfully')
  async get(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const sellerId = await this.productsService.resolveSellerProfileId(user.sub);
    return this.productsService.getProduct(id, sellerId);
  }

  @Post()
  @ResponseMessage('Product submitted for review')
  @ApiOperation({
    summary: 'Create product for review',
    description:
      'Seller identity comes from the Bearer token (no sellerId in body). ' +
      'Status is always set to PENDING_REVIEW until an admin approves the product.',
  })
  async create(
    @Body() dto: CreateSellerProductDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const sellerId = await this.productsService.resolveSellerProfileId(user.sub);
    return this.productsService.createProduct(dto, {
      isAdmin: false,
      sellerProfileId: sellerId,
      actorId: user.sub,
    });
  }

  @Patch(':id')
  @ResponseMessage('Product updated successfully')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const sellerId = await this.productsService.resolveSellerProfileId(user.sub);
    return this.productsService.updateProduct(id, dto, {
      isAdmin: false,
      sellerProfileId: sellerId,
    });
  }

  @Post(':id/images')
  @ResponseMessage('Product image uploaded successfully')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        isPrimary: { type: 'boolean' },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', createImageUploadOptions('products')),
  )
  async uploadImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtPayload,
    @Body('isPrimary') isPrimary?: string,
  ) {
    if (!file) {
      throw new BadRequestException('Product image file is required');
    }
    const sellerId = await this.productsService.resolveSellerProfileId(user.sub);
    return this.productsService.addProductImage(
      id,
      buildUploadedFilePath('products', file.filename),
      {
        sellerId,
        isPrimary: isPrimary === 'true' || isPrimary === '1',
      },
    );
  }

  @Delete(':id/images/:imageId')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Product image deleted successfully')
  async deleteImage(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const sellerId = await this.productsService.resolveSellerProfileId(user.sub);
    return this.productsService.deleteProductImage(id, imageId, sellerId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Product deleted successfully')
  async delete(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const sellerId = await this.productsService.resolveSellerProfileId(user.sub);
    return this.productsService.deleteProduct(id, sellerId);
  }
}
