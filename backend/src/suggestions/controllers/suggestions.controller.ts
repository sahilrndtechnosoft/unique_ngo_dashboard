import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppModule, JwtPayload, PermissionAction, UserRole } from '../../common/constants';
import { CurrentUser, RequirePermissions, ResponseMessage, Roles } from '../../common/decorators';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateSuggestionDto, ListSuggestionsQueryDto, UpdateSuggestionDto } from '../dto/suggestion.dto';
import { SuggestionsService } from '../services/suggestions.service';

@ApiTags('Suggestions')
@ApiBearerAuth()
@Controller('suggestions')
export class SuggestionsController {
  constructor(private readonly service: SuggestionsService) {}
  @Post()
  @ResponseMessage('Suggestion submitted successfully')
  @ApiOperation({ summary: 'Submit a suggestion or idea from the customer app' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateSuggestionDto) { return this.service.create(user.sub, dto); }
}

@ApiTags('Admin - Suggestions')
@ApiBearerAuth()
@Controller('admin/suggestions')
@UseGuards(RolesGuard, PermissionsGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminSuggestionsController {
  constructor(private readonly service: SuggestionsService) {}
  @Get() @RequirePermissions(AppModule.SUGGESTIONS, PermissionAction.VIEW) @ResponseMessage('Suggestions fetched successfully') @ApiOperation({ summary: 'List customer suggestions and ideas' }) list(@Query() query: ListSuggestionsQueryDto) { return this.service.list(query); }
  @Get(':id') @RequirePermissions(AppModule.SUGGESTIONS, PermissionAction.VIEW) @ResponseMessage('Suggestion fetched successfully') get(@Param('id') id: string) { return this.service.get(id); }
  @Patch(':id') @RequirePermissions(AppModule.SUGGESTIONS, PermissionAction.EDIT) @ResponseMessage('Suggestion updated successfully') update(@Param('id') id: string, @Body() dto: UpdateSuggestionDto, @CurrentUser() user: JwtPayload) { return this.service.update(id, dto, user.sub); }
  @Delete(':id') @HttpCode(HttpStatus.OK) @RequirePermissions(AppModule.SUGGESTIONS, PermissionAction.DELETE) @ResponseMessage('Suggestion deleted successfully') remove(@Param('id') id: string) { return this.service.remove(id); }
}
