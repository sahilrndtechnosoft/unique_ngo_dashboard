import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
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
import {
  donation_item_category,
  donation_item_condition,
  donation_item_status,
} from '../../../generated/prisma/client';

export class ListDonationItemsQueryDto {
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

  @ApiPropertyOptional({ enum: donation_item_category })
  @IsOptional()
  @IsEnum(donation_item_category)
  category?: donation_item_category;

  @ApiPropertyOptional({ enum: donation_item_condition })
  @IsOptional()
  @IsEnum(donation_item_condition)
  condition?: donation_item_condition;

  @ApiPropertyOptional({ enum: donation_item_status })
  @IsOptional()
  @IsEnum(donation_item_status)
  status?: donation_item_status;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}

export class AdminListDonationItemsQueryDto extends ListDonationItemsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  donorId?: string;

  @ApiPropertyOptional({ description: 'Filter by whether an admin has verified the listing' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  verified?: boolean;
}

export class CreateDonationItemDto {
  @ApiProperty({ example: 'Wooden dining table' })
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  title!: string;

  @ApiProperty({ example: 'Sturdy 4-seater dining table, minor scratches on top.' })
  @IsString()
  description!: string;

  @ApiPropertyOptional({ enum: donation_item_category })
  @IsOptional()
  @IsEnum(donation_item_category)
  category?: donation_item_category;

  @ApiPropertyOptional({ enum: donation_item_condition, default: donation_item_condition.GOOD })
  @IsOptional()
  @IsEnum(donation_item_condition)
  condition?: donation_item_condition;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiProperty({ example: 'Pune' })
  @IsString()
  @MaxLength(100)
  pickupCity!: string;

  @ApiProperty({ example: 'Maharashtra' })
  @IsString()
  @MaxLength(100)
  pickupState!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pickupAddress?: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isPickupOnly?: boolean;

  @ApiPropertyOptional({ type: [String], example: ['wooden', 'dining'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  tags?: string[];
}

export class UpdateDonationItemDto {
  @ApiPropertyOptional({ example: 'Wooden dining table' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: donation_item_category })
  @IsOptional()
  @IsEnum(donation_item_category)
  category?: donation_item_category;

  @ApiPropertyOptional({ enum: donation_item_condition })
  @IsOptional()
  @IsEnum(donation_item_condition)
  condition?: donation_item_condition;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  pickupCity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  pickupState?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pickupAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isPickupOnly?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  tags?: string[];
}

export class AdminUpdateDonationItemDto extends UpdateDonationItemDto {
  @ApiPropertyOptional({ enum: donation_item_status })
  @IsOptional()
  @IsEnum(donation_item_status)
  status?: donation_item_status;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  adminNote?: string;
}

export class RejectDonationItemDto {
  @ApiProperty({ example: 'Photos do not match the description' })
  @IsString()
  @MinLength(2)
  adminNote!: string;
}
