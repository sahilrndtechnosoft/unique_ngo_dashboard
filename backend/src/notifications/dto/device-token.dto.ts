import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RegisterDeviceTokenDto {
  @ApiProperty({ description: 'FCM registration token from the client device' })
  @IsString()
  token!: string;

  @ApiProperty({ example: 'ANDROID', description: 'Client platform, e.g. ANDROID, IOS, WEB' })
  @IsString()
  @MaxLength(50)
  platform!: string;

  @ApiPropertyOptional({ description: 'Stable per-device identifier, used to replace a stale token for the same device' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  deviceId?: string;
}
