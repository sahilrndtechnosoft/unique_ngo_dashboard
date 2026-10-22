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
  CreateCatalogItemDto,
  ListCatalogItemsQueryDto,
  UpdateCatalogItemDto,
} from '../dto/catalog.dto';
import { RewardsCatalogService } from '../services/rewards-catalog.service';

@ApiTags('Admin - Rewards Catalog')
@ApiBearerAuth()
@Controller('admin/rewards-catalog')
@UseGuards(RolesGuard, PermissionsGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminRewardsCatalogController {
  constructor(private readonly catalogService: RewardsCatalogService) {}

  @Get()
  @RequirePermissions(AppModule.REWARDS, PermissionAction.VIEW)
  @ResponseMessage('Rewards catalog items fetched successfully')
  list(@Query() query: ListCatalogItemsQueryDto) {
    return this.catalogService.listItems(query);
  }

  @Get(':id')
  @RequirePermissions(AppModule.REWARDS, PermissionAction.VIEW)
  @ResponseMessage('Rewards catalog item fetched successfully')
  getById(@Param('id') id: string) {
    return this.catalogService.getItemById(id);
  }

  @Post()
  @RequirePermissions(AppModule.REWARDS, PermissionAction.CREATE)
  @ResponseMessage('Rewards catalog item created successfully')
  create(@Body() dto: CreateCatalogItemDto) {
    return this.catalogService.createItem(dto);
  }

  @Patch(':id')
  @RequirePermissions(AppModule.REWARDS, PermissionAction.EDIT)
  @ResponseMessage('Rewards catalog item updated successfully')
  update(@Param('id') id: string, @Body() dto: UpdateCatalogItemDto) {
    return this.catalogService.updateItem(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(AppModule.REWARDS, PermissionAction.DELETE)
  @ResponseMessage('Rewards catalog item deleted successfully')
  delete(@Param('id') id: string) {
    return this.catalogService.deleteItem(id);
  }
}
