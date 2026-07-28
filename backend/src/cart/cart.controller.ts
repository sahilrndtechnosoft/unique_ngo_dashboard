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
import { CartService } from './cart.service';
import { AddCartItemDto, UpdateCartItemDto } from './dto/cart.dto';

@ApiTags('Cart')
@ApiBearerAuth()
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ResponseMessage('Cart fetched successfully')
  getCart(@CurrentUser() user: JwtPayload) {
    return this.cartService.getCart(user.sub);
  }

  @Post('items')
  @ResponseMessage('Item added to cart')
  addItem(@CurrentUser() user: JwtPayload, @Body() dto: AddCartItemDto) {
    return this.cartService.addItem(user.sub, dto);
  }

  @Patch('items/:itemId')
  @ResponseMessage('Cart item updated successfully')
  updateItem(
    @CurrentUser() user: JwtPayload,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartService.updateItem(user.sub, itemId, dto);
  }

  @Delete('items/:itemId')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Cart item removed successfully')
  removeItem(@CurrentUser() user: JwtPayload, @Param('itemId') itemId: string) {
    return this.cartService.removeItem(user.sub, itemId);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Cart cleared successfully')
  clearCart(@CurrentUser() user: JwtPayload) {
    return this.cartService.clearCart(user.sub);
  }
}
