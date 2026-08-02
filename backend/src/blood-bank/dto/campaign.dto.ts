import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
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
import { campaign_status, campaign_type } from '../../../generated/prisma/client';

export class ListCampaignsQueryDto {
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
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: campaign_status })
  @IsOptional()
  @IsEnum(campaign_status)
  status?: campaign_status;

  @ApiPropertyOptional({ enum: campaign_type })
  @IsOptional()
  @IsEnum(campaign_type)
  type?: campaign_type;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  hospitalId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;
}

export class CreateCampaignDto {
  @ApiProperty({ example: 'World Blood Donor Day Drive' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: campaign_type, default: campaign_type.BLOOD })
  @IsOptional()
  @IsEnum(campaign_type)
  type?: campaign_type;

  @ApiPropertyOptional({ enum: campaign_status, default: campaign_status.DRAFT })
  @IsOptional()
  @IsEnum(campaign_status)
  status?: campaign_status;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  hospitalId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  venueName?: string;

  @ApiProperty()
  @IsString()
  address!: string;

  @ApiProperty({ example: 'Pune' })
  @IsString()
  @MaxLength(100)
  city!: string;

  @ApiProperty({ example: 'Maharashtra' })
  @IsString()
  @MaxLength(100)
  state!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  organizerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  organizerMobile?: string;

  @ApiProperty()
  @IsDateString()
  startsAt!: string;

  @ApiProperty()
  @IsDateString()
  endsAt!: string;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  targetUnits?: number;

  @ApiPropertyOptional({ description: 'Link to the campaign’s connected donation-log sheet' })
  @IsOptional()
  @IsString()
  sheetUrl?: string;
}

export class UpdateCampaignDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: campaign_type })
  @IsOptional()
  @IsEnum(campaign_type)
  type?: campaign_type;

  @ApiPropertyOptional({ enum: campaign_status })
  @IsOptional()
  @IsEnum(campaign_status)
  status?: campaign_status;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  hospitalId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  venueName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  organizerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  organizerMobile?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  targetUnits?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sheetUrl?: string;
}
