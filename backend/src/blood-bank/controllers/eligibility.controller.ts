import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AppModule, JwtPayload, PermissionAction, UserRole } from '../../common/constants';
import { CurrentUser, RequirePermissions, ResponseMessage, Roles } from '../../common/decorators';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CheckEligibilityDto, UpdateEligibilitySettingsDto } from '../dto/eligibility.dto';
import { EligibilityService } from '../services/eligibility.service';

@ApiTags('Donation Eligibility')
@ApiBearerAuth()
@Controller('donation-eligibility')
export class EligibilityController {
  constructor(private readonly eligibilityService: EligibilityService) {}

  @Post('check')
  @ResponseMessage('Eligibility checked successfully')
  check(@CurrentUser() user: JwtPayload, @Body() dto: CheckEligibilityDto) {
    return this.eligibilityService.checkEligibility(user.sub, dto);
  }
}

@ApiTags('Admin - Donation Eligibility')
@ApiBearerAuth()
@Controller('admin/donation-eligibility-settings')
@UseGuards(RolesGuard, PermissionsGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminEligibilityController {
  constructor(private readonly eligibilityService: EligibilityService) {}

  @Get()
  @RequirePermissions(AppModule.BLOOD_BANK, PermissionAction.VIEW)
  @ResponseMessage('Eligibility settings fetched successfully')
  get() {
    return this.eligibilityService.getSettings();
  }

  @Patch()
  @RequirePermissions(AppModule.BLOOD_BANK, PermissionAction.EDIT)
  @ResponseMessage('Eligibility settings updated successfully')
  update(@Body() dto: UpdateEligibilitySettingsDto, @CurrentUser() user: JwtPayload) {
    return this.eligibilityService.updateSettings(dto, user.sub);
  }
}
