import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
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
import { catalog_item_type } from '../../../generated/prisma/client';

export class ListCatalogItemsQueryDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 'FOOD' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ enum: catalog_item_type })
  @IsOptional()
  @IsEnum(catalog_item_type)
  itemType?: catalog_item_type;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  partnerStoreId?: string;

  @ApiPropertyOptional({ example: 500, description: 'Filter items affordable within this max points cost' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxPoints?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}

export class CreateCatalogItemDto {
  @ApiPropertyOptional({ description: 'ID of partner store if this is a partner voucher' })
  @IsOptional()
  @IsUUID()
  partnerStoreId?: string;

  @ApiProperty({ example: '₹200 Pizza Hut Meal Voucher' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  title!: string;

  @ApiPropertyOptional({ example: 'Enjoy delicious pizza and sides with ₹200 off your total bill.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'https://images.example.com/pizzahut-200.jpg' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ example: 'FOOD', default: 'VOUCHER' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string = 'VOUCHER';

  @ApiProperty({ example: 200, description: 'Points required to redeem this item' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pointsCost!: number;

  @ApiProperty({ example: 200, description: 'Estimated monetary / cash value in INR' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  monetaryValue!: number;

  @ApiPropertyOptional({ enum: catalog_item_type, default: catalog_item_type.PARTNER_VOUCHER })
  @IsOptional()
  @IsEnum(catalog_item_type)
  itemType?: catalog_item_type = catalog_item_type.PARTNER_VOUCHER;

  @ApiPropertyOptional({ example: 100, description: 'Available stock quantity; null for unlimited' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock?: number;

  @ApiPropertyOptional({ example: 30, default: 30, description: 'Voucher validity in days once redeemed' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  validityDays?: number = 30;

  @ApiPropertyOptional({ example: 'BRONZE', default: 'BRONZE', description: 'Minimum user tier required to redeem' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  minUserTier?: string = 'BRONZE';

  @ApiPropertyOptional({ example: 'Valid at all Pizza Hut stores in India on dine-in and takeaway.' })
  @IsOptional()
  @IsString()
  termsAndConditions?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean = true;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class UpdateCatalogItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  partnerStoreId?: string;

  @ApiPropertyOptional({ example: '₹200 Pizza Hut Meal Voucher' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @ApiPropertyOptional({ example: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pointsCost?: number;

  @ApiPropertyOptional({ example: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  monetaryValue?: number;

  @ApiPropertyOptional({ enum: catalog_item_type })
  @IsOptional()
  @IsEnum(catalog_item_type)
  itemType?: catalog_item_type;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock?: number;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  validityDays?: number;

  @ApiPropertyOptional({ example: 'BRONZE' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  minUserTier?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  termsAndConditions?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
