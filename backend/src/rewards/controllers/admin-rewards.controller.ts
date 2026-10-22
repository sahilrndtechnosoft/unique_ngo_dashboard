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
import { AppModule, JwtPayload, PermissionAction, UserRole } from '../../common/constants';
import { CurrentUser, RequirePermissions, ResponseMessage, Roles } from '../../common/decorators';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  CreateRewardRuleDto,
  ListLedgerEntriesQueryDto,
  ListRewardRulesQueryDto,
  ManualPointsAdjustmentDto,
  UpdateRewardRuleDto,
} from '../dto/reward.dto';
import { RewardRulesService } from '../services/reward-rules.service';
import { RewardsService } from '../services/rewards.service';

@ApiTags('Admin - Rewards & Rules')
@ApiBearerAuth()
@Controller('admin/rewards')
@UseGuards(RolesGuard, PermissionsGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminRewardsController {
  constructor(
    private readonly rewardsService: RewardsService,
    private readonly rulesService: RewardRulesService,
  ) {}

  // 1. Reward Rules
  @Get('rules')
  @RequirePermissions(AppModule.REWARDS, PermissionAction.VIEW)
  @ResponseMessage('Reward rules fetched successfully')
  listRules(@Query() query: ListRewardRulesQueryDto) {
    return this.rulesService.listRules(query);
  }

  @Get('rules/:id')
  @RequirePermissions(AppModule.REWARDS, PermissionAction.VIEW)
  @ResponseMessage('Reward rule fetched successfully')
  getRule(@Param('id') id: string) {
    return this.rulesService.getRuleById(id);
  }

  @Post('rules')
  @RequirePermissions(AppModule.REWARDS, PermissionAction.CREATE)
  @ResponseMessage('Reward rule created successfully')
  createRule(@Body() dto: CreateRewardRuleDto, @CurrentUser() user: JwtPayload) {
    return this.rulesService.createRule(dto, user.sub);
  }

  @Patch('rules/:id')
  @RequirePermissions(AppModule.REWARDS, PermissionAction.EDIT)
  @ResponseMessage('Reward rule updated successfully')
  updateRule(@Param('id') id: string, @Body() dto: UpdateRewardRuleDto) {
    return this.rulesService.updateRule(id, dto);
  }

  @Delete('rules/:id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(AppModule.REWARDS, PermissionAction.DELETE)
  @ResponseMessage('Reward rule deleted successfully')
  deleteRule(@Param('id') id: string) {
    return this.rulesService.deleteRule(id);
  }

  // 2. Wallets & Points Management
  @Get('wallets')
  @RequirePermissions(AppModule.REWARDS, PermissionAction.VIEW)
  @ResponseMessage('Wallets fetched successfully')
  listWallets(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.rewardsService.listWallets(page ? Number(page) : 1, limit ? Number(limit) : 20);
  }

  @Get('wallets/:userId')
  @RequirePermissions(AppModule.REWARDS, PermissionAction.VIEW)
  @ResponseMessage('User wallet details fetched successfully')
  getUserWallet(@Param('userId') userId: string) {
    return this.rewardsService.getMyRewards(userId);
  }

  @Post('adjust')
  @RequirePermissions(AppModule.REWARDS, PermissionAction.EDIT)
  @ResponseMessage('Points adjusted successfully')
  adjustPoints(@Body() dto: ManualPointsAdjustmentDto, @CurrentUser() user: JwtPayload) {
    return this.rewardsService.adminAdjustPoints(dto, user.sub);
  }

  // 3. Ledger Audit
  @Get('ledger')
  @RequirePermissions(AppModule.REWARDS, PermissionAction.VIEW)
  @ResponseMessage('Ledger audit entries fetched successfully')
  listLedger(@Query() query: ListLedgerEntriesQueryDto) {
    return this.rewardsService.listLedger(query);
  }
}
