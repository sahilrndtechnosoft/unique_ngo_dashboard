import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtPayload } from '../../common/constants';
import { CurrentUser, ResponseMessage } from '../../common/decorators';
import { RegisterDeviceTokenDto } from '../dto/device-token.dto';
import { ListNotificationsQueryDto } from '../dto/notification.dto';
import { DeviceTokensService } from '../services/device-tokens.service';
import { NotificationsService } from '../services/notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class DeviceTokensController {
  constructor(
    private readonly deviceTokensService: DeviceTokensService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Post('device-tokens')
  @ResponseMessage('Device token registered successfully')
  registerToken(@CurrentUser() user: JwtPayload, @Body() dto: RegisterDeviceTokenDto) {
    return this.deviceTokensService.registerToken(user.sub, dto);
  }

  @Delete('device-tokens/:token')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Device token removed successfully')
  removeToken(@CurrentUser() user: JwtPayload, @Param('token') token: string) {
    return this.deviceTokensService.removeToken(user.sub, token);
  }

  @Get()
  @ResponseMessage('Notifications fetched successfully')
  listMyNotifications(@CurrentUser() user: JwtPayload, @Query() query: ListNotificationsQueryDto) {
    return this.notificationsService.listMyNotifications(user.sub, query);
  }

  @Get(':id')
  @ResponseMessage('Notification fetched successfully')
  getMyNotification(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.notificationsService.getMyNotification(user.sub, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Notification deleted successfully')
  deleteMyNotification(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.notificationsService.deleteMyNotification(user.sub, id);
  }
}
