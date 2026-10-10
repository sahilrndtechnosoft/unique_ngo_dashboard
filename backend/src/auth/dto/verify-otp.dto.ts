import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';
import { INDIAN_MOBILE_REGEX } from '../../common/constants';
import { DeviceInfoDto } from './device-info.dto';

export class VerifyOtpDto extends DeviceInfoDto {
  @ApiProperty({ example: '9876543210' })
  @Matches(INDIAN_MOBILE_REGEX, {
    message: 'Mobile number must be a valid 10-digit Indian number',
  })
  mobileNumber!: string;

  @ApiProperty({ example: '1234' })
  @Matches(/^\d{4,6}$/, { message: 'OTP must be a 4 to 6-digit number' })
  otp!: string;
}
