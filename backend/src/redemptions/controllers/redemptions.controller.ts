import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtPayload } from '../../common/constants';
import { CurrentUser, ResponseMessage } from '../../common/decorators';
import {
  ListRedemptionsQueryDto,
  RedeemCatalogItemDto,
} from '../dto/redemption.dto';
import { RedemptionsService } from '../services/redemptions.service';

@ApiTags('Redemptions')
@ApiBearerAuth()
@Controller('redemptions')
export class RedemptionsController {
  constructor(private readonly redemptionsService: RedemptionsService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ResponseMessage('Points redeemed successfully')
  redeem(
    @CurrentUser() user: JwtPayload,
    @Body() dto: RedeemCatalogItemDto,
  ) {
    return this.redemptionsService.redeemCatalogItem(user.sub, dto);
  }

  @Get('my')
  @ResponseMessage('Redemption history fetched successfully')
  listMy(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListRedemptionsQueryDto,
  ) {
    return this.redemptionsService.listMyRedemptions(user.sub, query);
  }
}
