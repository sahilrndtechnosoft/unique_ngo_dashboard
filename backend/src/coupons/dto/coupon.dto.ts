import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
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

const DISCOUNT_TYPES = ['PERCENTAGE', 'FLAT'] as const;
const APPLICABLE_TO = ['ALL', 'PRODUCTS', 'BLOOD_BANK'] as const;

export class ListCouponsQueryDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  partnerStoreId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}

export class CreateCouponDto {
  @ApiProperty({ example: 'WELCOME10' })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  code!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: DISCOUNT_TYPES, default: 'PERCENTAGE' })
  @IsOptional()
  @IsIn(DISCOUNT_TYPES)
  discountType?: (typeof DISCOUNT_TYPES)[number];

  @ApiProperty({ example: 10 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountValue!: number;

  @ApiPropertyOptional({ example: 500, description: 'Minimum order value for this coupon to apply' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minOrderValue?: number;

  @ApiPropertyOptional({ example: 200, description: 'Cap on the discount amount, useful for percentage coupons' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxDiscount?: number;

  @ApiPropertyOptional({ example: 100, description: 'Total number of times this coupon can be used across all users' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  usageLimit?: number;

  @ApiPropertyOptional({ example: 1, default: 1, description: 'How many times a single user can use this coupon' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  perUserLimit?: number;

  @ApiPropertyOptional({ enum: APPLICABLE_TO, default: 'ALL' })
  @IsOptional()
  @IsIn(APPLICABLE_TO)
  applicableTo?: (typeof APPLICABLE_TO)[number];

  @ApiPropertyOptional({ description: 'ID of partner store if coupon is restricted to a partner' })
  @IsOptional()
  @IsUUID()
  partnerStoreId?: string;

  @ApiPropertyOptional({ default: false, description: 'Whether this coupon can be stacked with other coupons' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  stackingAllowed?: boolean = false;

  @ApiPropertyOptional({ example: 'STORE_DISCOUNT' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  stackingGroup?: string;

  @ApiPropertyOptional({ default: false, description: 'Whether this coupon grants free delivery/shipping' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  freeShipping?: boolean = false;

  @ApiPropertyOptional({ example: '2026-08-01' })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class UpdateCouponDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: DISCOUNT_TYPES })
  @IsOptional()
  @IsIn(DISCOUNT_TYPES)
  discountType?: (typeof DISCOUNT_TYPES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountValue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minOrderValue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxDiscount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  usageLimit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  perUserLimit?: number;

  @ApiPropertyOptional({ enum: APPLICABLE_TO })
  @IsOptional()
  @IsIn(APPLICABLE_TO)
  applicableTo?: (typeof APPLICABLE_TO)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  partnerStoreId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  stackingAllowed?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  stackingGroup?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  freeShipping?: boolean;

  @ApiPropertyOptional({ example: '2026-08-01' })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ description: 'Activate or deactivate the coupon' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ValidateCouponCartDto {
  @ApiProperty({ example: 'SAVE20', description: 'Coupon code to test and apply' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  code!: string;

  @ApiProperty({ example: 450, description: 'Order subtotal / cart total amount before coupon discount' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  orderTotal!: number;

  @ApiPropertyOptional({ description: 'ID of partner store if items are from a partner' })
  @IsOptional()
  @IsUUID()
  partnerStoreId?: string;
}
