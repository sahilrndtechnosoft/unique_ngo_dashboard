import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { redemption_status } from '../../../generated/prisma/client';

export class RedeemCatalogItemDto {
  @ApiProperty({
    example: 'b7eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    description: 'Catalog Item ID to redeem with points',
  })
  @IsUUID()
  catalogItemId!: string;

  @ApiPropertyOptional({
    example: 'idem-user123-catItem456-epoch',
    description: 'Client idempotency key to prevent double clicks and duplicate redemptions',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;
}

export class ListRedemptionsQueryDto {
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

  @ApiPropertyOptional({ enum: redemption_status })
  @IsOptional()
  @IsEnum(redemption_status)
  status?: redemption_status;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  catalogItemId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  partnerStoreId?: string;
}

export class AdminRefundRedemptionDto {
  @ApiProperty({ example: 'Partner store closed or defective voucher code reported' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
