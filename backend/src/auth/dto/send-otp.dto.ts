import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';
import { INDIAN_MOBILE_REGEX } from '../../common/constants';

export class SendOtpDto {
  @ApiProperty({ example: '9876543210', description: '10-digit Indian mobile number' })
  @Matches(INDIAN_MOBILE_REGEX, {
    message: 'Mobile number must be a valid 10-digit Indian number',
  })
  mobileNumber!: string;
}
