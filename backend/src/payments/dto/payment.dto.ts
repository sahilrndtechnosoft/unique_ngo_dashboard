import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class VerifyRazorpayPaymentDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  razorpayOrderId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  razorpayPaymentId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  razorpaySignature!: string;
}
