import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { notification_type } from '../../../generated/prisma/client';

export class ListNotificationsQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class ListAdminNotificationsQueryDto extends ListNotificationsQueryDto {
  @ApiPropertyOptional({ description: 'Search by title or body' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: notification_type })
  @IsOptional()
  @IsEnum(notification_type)
  type?: notification_type;
}
