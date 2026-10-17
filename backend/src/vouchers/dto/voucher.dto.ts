import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { voucher_status } from '../../../generated/prisma/client';

export class ListMyVouchersQueryDto {
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

  @ApiPropertyOptional({ enum: voucher_status })
  @IsOptional()
  @IsEnum(voucher_status)
  status?: voucher_status;
}

export class ListAllVouchersQueryDto extends ListMyVouchersQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  partnerStoreId?: string;

  @ApiPropertyOptional({ description: 'Search by voucher code or title' })
  @IsOptional()
  @IsString()
  search?: string;
}

export class RedeemVoucherDto {
  @ApiProperty({ example: 'PH-9X7K-4M2Q-8V3Z', description: 'Unique voucher code' })
  @IsString()
  @MinLength(6)
  @MaxLength(100)
  code!: string;

  @ApiPropertyOptional({ example: '4829', description: 'Security PIN (if required)' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  securityPin?: string;

  @ApiPropertyOptional({ example: 'Store #104 - Bandra West, Mumbai' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  storeLocation?: string;
}

export class VerifyVoucherDto {
  @ApiProperty({ example: 'PH-9X7K-4M2Q-8V3Z' })
  @IsString()
  @MinLength(6)
  @MaxLength(100)
  code!: string;

  @ApiPropertyOptional({ example: '4829' })
  @IsOptional()
  @IsString()
  securityPin?: string;
}

export class CancelVoucherDto {
  @ApiProperty({ example: 'Customer requested cancellation or wrong partner issue' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class AdminIssueVoucherDto {
  @ApiProperty({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  @IsUUID()
  userId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  partnerStoreId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  catalogItemId?: string;

  @ApiProperty({ example: 'Special Goodwill Voucher ₹500' })
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 0, description: 'Points deducted for this voucher (0 if complimentary)' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  pointsSpent!: number;

  @ApiProperty({ example: 500, description: 'Monetary value in INR' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  monetaryValue!: number;

  @ApiPropertyOptional({ example: 30, default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  validityDays?: number = 30;
}
