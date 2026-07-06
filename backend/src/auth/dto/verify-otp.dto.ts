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

  @ApiProperty({ example: '123456' })
  @Matches(/^\d{6}$/, { message: 'OTP must be a 6-digit number' })
  otp!: string;
}
