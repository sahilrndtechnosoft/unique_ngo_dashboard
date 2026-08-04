import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtPayload } from '../common/constants';
import { CurrentUser, ResponseMessage } from '../common/decorators';
import { AddWishlistItemDto } from './dto/wishlist.dto';
import { WishlistService } from './wishlist.service';

@ApiTags('Wishlist')
@ApiBearerAuth()
@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  @ResponseMessage('Wishlist fetched successfully')
  getWishlist(@CurrentUser() user: JwtPayload) {
    return this.wishlistService.getWishlist(user.sub);
  }

  @Post()
  @ResponseMessage('Item added to wishlist')
  addItem(@CurrentUser() user: JwtPayload, @Body() dto: AddWishlistItemDto) {
    return this.wishlistService.addItem(user.sub, dto);
  }

  @Delete(':productId')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Item removed from wishlist')
  removeItem(@CurrentUser() user: JwtPayload, @Param('productId') productId: string) {
    return this.wishlistService.removeItem(user.sub, productId);
  }
}
