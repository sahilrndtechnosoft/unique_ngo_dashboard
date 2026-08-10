import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtPayload } from '../../common/constants';
import { CurrentUser, ResponseMessage } from '../../common/decorators';
import { RewardsService } from '../services/rewards.service';

@ApiTags('Rewards')
@ApiBearerAuth()
@Controller('rewards')
export class RewardsController {
  constructor(private readonly rewardsService: RewardsService) {}

  @Get()
  @ResponseMessage('Rewards fetched successfully')
  getMyRewards(@CurrentUser() user: JwtPayload) {
    return this.rewardsService.getMyRewards(user.sub);
  }
}
