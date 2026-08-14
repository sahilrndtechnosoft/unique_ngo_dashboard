import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { approval_status } from '../../../generated/prisma/client';

export class ListDonationItemRequestsQueryDto {
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

  @ApiPropertyOptional({ enum: approval_status })
  @IsOptional()
  @IsEnum(approval_status)
  status?: approval_status;
}

export class AdminListDonationItemRequestsQueryDto extends ListDonationItemRequestsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  donationItemId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  requesterId?: string;
}

export class CreateDonationItemRequestDto {
  @ApiProperty()
  @IsUUID()
  donationItemId!: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantityNeeded?: number;

  @ApiProperty({ example: 'I need this for my new apartment, moving in next week.' })
  @IsString()
  @MinLength(5)
  purpose!: string;
}

export class RespondDonationItemRequestDto {
  @ApiProperty({ enum: approval_status, example: approval_status.APPROVED })
  @IsEnum(approval_status)
  status!: approval_status;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  adminNote?: string;
}

export class AdminUpdateDonationItemRequestDto {
  @ApiPropertyOptional({ enum: approval_status })
  @IsOptional()
  @IsEnum(approval_status)
  status?: approval_status;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  adminNote?: string;
}
