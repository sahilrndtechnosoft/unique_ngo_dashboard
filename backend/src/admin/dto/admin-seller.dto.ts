import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { INDIAN_MOBILE_REGEX } from '../../common/constants';
import { seller_status } from '../../../generated/prisma/client';

export class ListSellersQueryDto {
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

  @ApiPropertyOptional({ example: 'pharmacy' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: seller_status })
  @IsOptional()
  @IsEnum(seller_status)
  status?: seller_status;
}

export class CreateAdminSellerDto {
  @ApiProperty({ example: 'Rajesh Kumar' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  fullName!: string;

  @ApiProperty({ example: 'seller2@unique-ngo.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '9765432109' })
  @Matches(INDIAN_MOBILE_REGEX, {
    message: 'Mobile number must be a valid 10-digit Indian number',
  })
  mobile!: string;

  @ApiProperty({ example: 'Seller@123456' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'Health Plus Store' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  businessName!: string;

  @ApiPropertyOptional({ example: 'Pharmacy' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  businessType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: seller_status, example: seller_status.ACTIVE })
  @IsOptional()
  @IsEnum(seller_status)
  status?: seller_status;
}

export class UpdateAdminSellerDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  fullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(INDIAN_MOBILE_REGEX)
  mobile?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  businessName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  businessType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  gstNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  panNumber?: string;

  @ApiPropertyOptional({ enum: seller_status })
  @IsOptional()
  @IsEnum(seller_status)
  status?: seller_status;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rejectionReason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionRate?: number;
}
