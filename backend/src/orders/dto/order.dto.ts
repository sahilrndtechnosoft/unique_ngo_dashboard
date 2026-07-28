import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { order_status, payment_method } from '../../../generated/prisma/client';

export class CheckoutDto {
  @ApiProperty()
  @IsUUID()
  shippingAddressId!: string;

  @ApiProperty({ enum: payment_method })
  @IsEnum(payment_method)
  paymentMethod!: payment_method;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ListOrdersQueryDto {
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

  @ApiPropertyOptional({ enum: order_status })
  @IsOptional()
  @IsEnum(order_status)
  status?: order_status;
}
