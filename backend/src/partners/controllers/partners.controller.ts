import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ResponseMessage } from '../../common/decorators';
import { ListPartnerStoresQueryDto } from '../dto/partner.dto';
import { PartnersService } from '../services/partners.service';

@ApiTags('Partner Stores')
@Controller('partners')
export class PartnersController {
  constructor(private readonly partnersService: PartnersService) {}

  @Get()
  @ResponseMessage('Active partner stores fetched successfully')
  listActive(@Query() query: ListPartnerStoresQueryDto) {
    return this.partnersService.listPartners({ ...query, isActive: true });
  }

  @Get(':slug')
  @ResponseMessage('Partner store fetched successfully')
  getBySlug(@Param('slug') slug: string) {
    return this.partnersService.getPartnerBySlug(slug);
  }
}
