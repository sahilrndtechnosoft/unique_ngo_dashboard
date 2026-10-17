import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtPayload } from '../../common/constants';
import { CurrentUser, Public, ResponseMessage } from '../../common/decorators';
import {
  ListMyVouchersQueryDto,
  RedeemVoucherDto,
  VerifyVoucherDto,
} from '../dto/voucher.dto';
import { VouchersService } from '../services/vouchers.service';

@ApiTags('Vouchers')
@ApiBearerAuth()
@Controller('vouchers')
export class VouchersController {
  constructor(private readonly vouchersService: VouchersService) {}

  @Get('my')
  @ResponseMessage('User vouchers fetched successfully')
  listMy(@CurrentUser() user: JwtPayload, @Query() query: ListMyVouchersQueryDto) {
    return this.vouchersService.listMyVouchers(user.sub, query);
  }

  @Get(':id')
  @ResponseMessage('Voucher details fetched successfully')
  getMyDetail(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.vouchersService.getMyVoucherDetail(user.sub, id);
  }

  @Post('verify')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Voucher verified successfully')
  verify(@Body() dto: VerifyVoucherDto) {
    return this.vouchersService.verifyVoucher(dto);
  }

  @Post('redeem')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Voucher redeemed successfully')
  redeem(@Body() dto: RedeemVoucherDto, @CurrentUser() user: JwtPayload) {
    return this.vouchersService.redeemVoucher(dto, {
      actorType: 'USER',
      actorId: user.sub,
    });
  }
}
