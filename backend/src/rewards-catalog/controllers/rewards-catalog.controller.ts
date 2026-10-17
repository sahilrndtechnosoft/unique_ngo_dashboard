import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public, ResponseMessage } from '../../common/decorators';
import { ListCatalogItemsQueryDto } from '../dto/catalog.dto';
import { RewardsCatalogService } from '../services/rewards-catalog.service';

@ApiTags('Rewards Catalog')
@Controller('rewards-catalog')
export class RewardsCatalogController {
  constructor(private readonly catalogService: RewardsCatalogService) {}

  @Get()
  @Public()
  @ResponseMessage('Reward catalog items fetched successfully')
  list(@Query() query: ListCatalogItemsQueryDto) {
    return this.catalogService.listItems({ ...query, isActive: true });
  }

  @Get(':id')
  @Public()
  @ResponseMessage('Reward catalog item fetched successfully')
  getById(@Param('id') id: string) {
    return this.catalogService.getItemById(id);
  }
}
