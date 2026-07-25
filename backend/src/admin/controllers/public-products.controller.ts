import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { product_status } from '../../../generated/prisma/client';
import { Public, ResponseMessage } from '../../common/decorators';
import { ListProductsQueryDto } from '../dto/product.dto';
import { ProductsService } from '../services/products.service';

@ApiTags('Public - Products')
@Controller('public/products')
@Public()
export class PublicProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ResponseMessage('Products fetched successfully')
  @ApiOperation({ summary: 'List active products for storefront/apps' })
  list(@Query() query: ListProductsQueryDto) {
    return this.productsService.listProducts(query, {
      forcedStatus: product_status.ACTIVE,
    });
  }

  @Get(':idOrSlug')
  @ResponseMessage('Product fetched successfully')
  @ApiOperation({ summary: 'Get an active product by id or slug' })
  get(@Param('idOrSlug') idOrSlug: string) {
    return this.productsService.getPublicProduct(idOrSlug);
  }
}
