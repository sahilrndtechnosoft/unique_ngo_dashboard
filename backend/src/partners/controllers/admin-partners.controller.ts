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
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AppModule, PermissionAction, UserRole } from '../../common/constants';
import { RequirePermissions, ResponseMessage, Roles } from '../../common/decorators';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  CreatePartnerStoreDto,
  ListPartnerStoresQueryDto,
  UpdatePartnerStoreDto,
} from '../dto/partner.dto';
import { PartnersService } from '../services/partners.service';

@ApiTags('Admin - Partner Stores')
@ApiBearerAuth()
@Controller('admin/partners')
@UseGuards(RolesGuard, PermissionsGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminPartnersController {
  constructor(private readonly partnersService: PartnersService) {}

  @Get()
  @RequirePermissions(AppModule.REWARDS, PermissionAction.VIEW)
  @ResponseMessage('Partner stores fetched successfully')
  list(@Query() query: ListPartnerStoresQueryDto) {
    return this.partnersService.listPartners(query);
  }

  @Get(':id')
  @RequirePermissions(AppModule.REWARDS, PermissionAction.VIEW)
  @ResponseMessage('Partner store fetched successfully')
  getById(@Param('id') id: string) {
    return this.partnersService.getPartnerById(id);
  }

  @Post()
  @RequirePermissions(AppModule.REWARDS, PermissionAction.CREATE)
  @ResponseMessage('Partner store created successfully')
  create(@Body() dto: CreatePartnerStoreDto) {
    return this.partnersService.createPartner(dto);
  }

  @Patch(':id')
  @RequirePermissions(AppModule.REWARDS, PermissionAction.EDIT)
  @ResponseMessage('Partner store updated successfully')
  update(@Param('id') id: string, @Body() dto: UpdatePartnerStoreDto) {
    return this.partnersService.updatePartner(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(AppModule.REWARDS, PermissionAction.DELETE)
  @ResponseMessage('Partner store deleted successfully')
  delete(@Param('id') id: string) {
    return this.partnersService.deletePartner(id);
  }
}
