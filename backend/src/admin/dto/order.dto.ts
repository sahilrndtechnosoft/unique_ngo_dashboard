import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { order_status, payment_method, payment_status, shipping_type } from '../../../generated/prisma/client';

export class AdminSaleItemDto {
  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @ApiProperty({ example: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class AdminSaleAddressDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  fullName!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(20)
  mobile!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  addressLine1!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  addressLine2?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  city!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  state!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(20)
  postalCode!: string;

  @ApiPropertyOptional({ default: 'India' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;
}

export class CreateAdminSaleDto {
  @ApiPropertyOptional({ enum: ['ADMIN_COUNTER', 'ADMIN_PHONE'], default: 'ADMIN_COUNTER' })
  @IsOptional()
  @IsIn(['ADMIN_COUNTER', 'ADMIN_PHONE'])
  source?: 'ADMIN_COUNTER' | 'ADMIN_PHONE';

  @ApiPropertyOptional({ description: 'Link the sale to an existing customer account' })
  @IsOptional()
  @IsUUID()
  buyerId?: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  buyerName!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(20)
  buyerMobile!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  buyerEmail?: string;

  @ApiPropertyOptional({ type: AdminSaleAddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AdminSaleAddressDto)
  shippingAddress?: AdminSaleAddressDto;

  @ApiProperty({ enum: shipping_type })
  @IsEnum(shipping_type)
  shippingType!: shipping_type;

  @ApiPropertyOptional({ description: 'Delivery charge recorded for shipped admin orders', minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  shippingFee?: number;

  @ApiProperty({ enum: payment_method })
  @IsEnum(payment_method)
  paymentMethod!: payment_method;

  @ApiPropertyOptional({ enum: payment_status, default: payment_status.SUCCESS })
  @IsOptional()
  @IsEnum(payment_status)
  paymentStatus?: payment_status;

  @ApiProperty({ type: [AdminSaleItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminSaleItemDto)
  items!: AdminSaleItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

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

export class FulfillShiprocketDto {
  @ApiPropertyOptional({ description: 'Courier company ID from the Shiprocket serviceability quote' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  courierCompanyId?: number;
}
