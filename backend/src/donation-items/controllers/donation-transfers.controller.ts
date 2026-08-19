import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { AppModule, JwtPayload, PermissionAction, UserRole } from '../../common/constants';
import { CurrentUser, RequirePermissions, ResponseMessage, Roles } from '../../common/decorators';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { buildUploadedFilePath, createImageUploadOptions } from '../../common/utils/image-upload.util';
import {
  AdminConfirmDonationTransferDto,
  AdminListDonationTransfersQueryDto,
  ConfirmDonationTransferDto,
  ListDonationTransfersQueryDto,
} from '../dto/donation-transfer.dto';
import { DonationTransfersService } from '../services/donation-transfers.service';

@ApiTags('Donation Transfers')
@ApiBearerAuth()
@Controller('donation-transfers')
export class DonationTransfersController {
  constructor(private readonly transfersService: DonationTransfersService) {}

  @Get('mine')
  @ResponseMessage('Your transfers fetched successfully')
  listMine(@CurrentUser() user: JwtPayload, @Query() query: ListDonationTransfersQueryDto) {
    return this.transfersService.listMine(user.sub, query);
  }

  @Get(':id')
  @ResponseMessage('Transfer fetched successfully')
  get(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.transfersService.get(user.sub, id);
  }

  @Patch(':id/confirm')
  @ResponseMessage('Transfer confirmed successfully')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'Optional handover proof photo' },
        transferDate: { type: 'string', format: 'date' },
        notes: { type: 'string' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', createImageUploadOptions('donation-transfers')))
  confirm(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ConfirmDonationTransferDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.transfersService.confirm(user.sub, id, dto, file ? buildUploadedFilePath('donation-transfers', file.filename) : undefined);
  }
}

@ApiTags('Admin - Donation Transfers')
@ApiBearerAuth()
@Controller('admin/donation-transfers')
@UseGuards(RolesGuard, PermissionsGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminDonationTransfersController {
  constructor(private readonly transfersService: DonationTransfersService) {}

  @Get()
  @RequirePermissions(AppModule.DONATIONS, PermissionAction.VIEW)
  @ResponseMessage('Transfers fetched successfully')
  list(@Query() query: AdminListDonationTransfersQueryDto) {
    return this.transfersService.adminList(query);
  }

  @Get(':id')
  @RequirePermissions(AppModule.DONATIONS, PermissionAction.VIEW)
  @ResponseMessage('Transfer fetched successfully')
  get(@Param('id') id: string) {
    return this.transfersService.adminGet(id);
  }

  @Patch(':id/confirm')
  @RequirePermissions(AppModule.DONATIONS, PermissionAction.EDIT)
  @ResponseMessage('Transfer confirmed successfully')
  confirm(@Param('id') id: string, @Body() dto: AdminConfirmDonationTransferDto) {
    return this.transfersService.adminConfirm(id, dto);
  }
}
