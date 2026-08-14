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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AppModule,
  JwtPayload,
  PermissionAction,
  UserRole,
} from '../../common/constants';
import {
  CurrentUser,
  RequirePermissions,
  ResponseMessage,
  Roles,
} from '../../common/decorators';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreatePageDto, ListPagesQueryDto, UpdatePageDto } from '../dto/page.dto';
import { PagesService } from '../services/pages.service';

@ApiTags('Admin - Pages')
@ApiBearerAuth()
@Controller('admin/pages')
@UseGuards(RolesGuard, PermissionsGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @Get()
  @RequirePermissions(AppModule.SETTINGS, PermissionAction.VIEW)
  @ResponseMessage('Pages fetched successfully')
  @ApiOperation({ summary: 'List Government Policy, Emergency, and Information pages' })
  listPages(@Query() query: ListPagesQueryDto) {
    return this.pagesService.listPages(false, query.type);
  }

  @Get(':id')
  @RequirePermissions(AppModule.SETTINGS, PermissionAction.VIEW)
  @ResponseMessage('Page fetched successfully')
  @ApiOperation({ summary: 'Get a single page' })
  getPage(@Param('id') id: string) {
    return this.pagesService.getPage(id);
  }

  @Post()
  @RequirePermissions(AppModule.SETTINGS, PermissionAction.CREATE)
  @ResponseMessage('Page created successfully')
  @ApiOperation({ summary: 'Create a new page' })
  createPage(@CurrentUser() user: JwtPayload, @Body() dto: CreatePageDto) {
    return this.pagesService.createPage(dto, user.sub);
  }

  @Patch(':id')
  @RequirePermissions(AppModule.SETTINGS, PermissionAction.EDIT)
  @ResponseMessage('Page updated successfully')
  @ApiOperation({ summary: 'Update a page' })
  updatePage(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdatePageDto,
  ) {
    return this.pagesService.updatePage(id, dto, user.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(AppModule.SETTINGS, PermissionAction.DELETE)
  @ResponseMessage('Page deleted successfully')
  @ApiOperation({ summary: 'Delete a page' })
  deletePage(@Param('id') id: string) {
    return this.pagesService.deletePage(id);
  }
}
