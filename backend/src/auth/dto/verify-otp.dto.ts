import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';
import { INDIAN_MOBILE_REGEX } from '../../common/constants';

export class VerifyOtpDto {
  @ApiProperty({ example: '9876543210' })
  @Matches(INDIAN_MOBILE_REGEX, {
    message: 'Mobile number must be a valid 10-digit Indian number',
  })
  mobileNumber!: string;

  @ApiProperty({ example: '123456' })
  @Matches(/^\d{6}$/, { message: 'OTP must be a 6-digit number' })
  otp!: string;
}
