import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtPayload } from '../common/constants';
import { CurrentUser, ResponseMessage } from '../common/decorators';
import { AddressesService } from './addresses.service';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';

@ApiTags('Addresses')
@ApiBearerAuth()
@Controller('addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  @ResponseMessage('Addresses fetched successfully')
  list(@CurrentUser() user: JwtPayload) {
    return this.addressesService.listAddresses(user.sub);
  }

  @Post()
  @ResponseMessage('Address added successfully')
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateAddressDto) {
    return this.addressesService.createAddress(user.sub, dto);
  }

  @Patch(':id')
  @ResponseMessage('Address updated successfully')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.addressesService.updateAddress(user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Address deleted successfully')
  delete(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.addressesService.deleteAddress(user.sub, id);
  }
}
