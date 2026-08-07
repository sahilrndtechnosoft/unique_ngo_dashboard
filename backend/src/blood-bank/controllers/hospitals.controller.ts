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
import { AppModule, JwtPayload, PermissionAction, UserRole } from '../../common/constants';
import { CurrentUser, Public, RequirePermissions, ResponseMessage, Roles } from '../../common/decorators';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateHospitalDto, ListHospitalsQueryDto, UpdateHospitalDto } from '../dto/hospital.dto';
import { HospitalsService } from '../services/hospitals.service';

@ApiTags('Admin - Hospitals')
@ApiBearerAuth()
@Controller('admin/hospitals')
@UseGuards(RolesGuard, PermissionsGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminHospitalsController {
  constructor(private readonly hospitalsService: HospitalsService) {}

  @Get()
  @RequirePermissions(AppModule.BLOOD_BANK, PermissionAction.VIEW)
  @ResponseMessage('Hospitals fetched successfully')
  list(@Query() query: ListHospitalsQueryDto) {
    return this.hospitalsService.listHospitals(query);
  }

  @Get(':id')
  @RequirePermissions(AppModule.BLOOD_BANK, PermissionAction.VIEW)
  @ResponseMessage('Hospital fetched successfully')
  get(@Param('id') id: string) {
    return this.hospitalsService.getHospital(id);
  }

  @Post()
  @RequirePermissions(AppModule.BLOOD_BANK, PermissionAction.CREATE)
  @ResponseMessage('Hospital created successfully')
  create(@Body() dto: CreateHospitalDto, @CurrentUser() user: JwtPayload) {
    return this.hospitalsService.createHospital(dto, user.sub);
  }

  @Patch(':id')
  @RequirePermissions(AppModule.BLOOD_BANK, PermissionAction.EDIT)
  @ResponseMessage('Hospital updated successfully')
  update(@Param('id') id: string, @Body() dto: UpdateHospitalDto) {
    return this.hospitalsService.updateHospital(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(AppModule.BLOOD_BANK, PermissionAction.DELETE)
  @ResponseMessage('Hospital deleted successfully')
  delete(@Param('id') id: string) {
    return this.hospitalsService.deleteHospital(id);
  }
}

@ApiTags('Hospitals')
@Controller('hospitals')
export class HospitalsController {
  constructor(private readonly hospitalsService: HospitalsService) {}

  @Public()
  @Get()
  @ResponseMessage('Active hospitals fetched successfully')
  @ApiOperation({ summary: 'List active hospitals for donor booking' })
  listActive(@Query() query: ListHospitalsQueryDto) {
    return this.hospitalsService.listHospitals(query, true);
  }

  @Public()
  @Get(':id')
  @ResponseMessage('Hospital fetched successfully')
  get(@Param('id') id: string) {
    return this.hospitalsService.getHospital(id);
  }
}
