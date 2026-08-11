import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { order_status } from '../../../generated/prisma/client';

export class ListAdminOrdersQueryDto {
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
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Matches order number or buyer name/email/mobile' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: order_status })
  @IsOptional()
  @IsEnum(order_status)
  status?: order_status;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  sellerId?: string;

  @ApiPropertyOptional({ description: 'Filter to orders placed by a specific buyer' })
  @IsOptional()
  @IsUUID()
  buyerId?: string;

  @ApiPropertyOptional({ description: 'Filter to orders that contain a specific product' })
  @IsOptional()
  @IsUUID()
  productId?: string;
}

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: order_status })
  @IsEnum(order_status)
  status!: order_status;

  @ApiPropertyOptional({ description: 'Optional tracking note shown to the buyer' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ description: 'Optional tracking location shown to the buyer' })
  @IsOptional()
  @IsString()
  location?: string;
}
