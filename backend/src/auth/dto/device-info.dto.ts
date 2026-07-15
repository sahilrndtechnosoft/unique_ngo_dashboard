import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Request } from 'express';

export interface SessionMetadata {
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
  deviceName?: string;
  deviceType?: string;
  os?: string;
  appVersion?: string;
}

export class DeviceInfoDto {
  @ApiPropertyOptional({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  deviceId?: string;

  @ApiPropertyOptional({ example: 'iPhone 15 Pro' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  deviceName?: string;

  @ApiPropertyOptional({ example: 'mobile' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceType?: string;

  @ApiPropertyOptional({ example: 'iOS 18' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  os?: string;

  @ApiPropertyOptional({ example: '1.2.0' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  appVersion?: string;
}

export function toSessionMetadata(
  device: DeviceInfoDto | undefined,
  req: Pick<Request, 'ip' | 'headers'>,
): SessionMetadata {
  return {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    deviceId: device?.deviceId,
    deviceName: device?.deviceName,
    deviceType: device?.deviceType,
    os: device?.os,
    appVersion: device?.appVersion,
  };
}
