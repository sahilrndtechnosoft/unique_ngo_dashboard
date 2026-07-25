import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { banner_placement } from '../../../generated/prisma/client';

export class ListBannersQueryDto {
  @ApiPropertyOptional({ enum: banner_placement })
  @IsOptional()
  @IsEnum(banner_placement)
  placement?: banner_placement;

  @ApiPropertyOptional({ example: 'TOP', description: 'Position within the page, e.g. TOP, MIDDLE, BOTTOM' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  slot?: string;
}

export class CreateBannerDto {
  @ApiPropertyOptional({ example: 'Donate Blood, Save Lives' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ example: 'Join our nationwide blood donation drive' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  subtitle?: string;

  @ApiPropertyOptional({ example: 'Every drop counts. Join thousands of donors making a difference across the country.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'https://unique-ngo.com/blood-drive' })
  @IsOptional()
  @IsString()
  linkUrl?: string;

  @ApiPropertyOptional({ example: 'Learn More' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  buttonText?: string;

  @ApiPropertyOptional({ enum: banner_placement, default: banner_placement.HOME })
  @IsOptional()
  @IsEnum(banner_placement)
  placement?: banner_placement;

  @ApiPropertyOptional({ example: 'TOP', description: 'Position within the page, e.g. TOP, MIDDLE, BOTTOM' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  slot?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateBannerDto {
  @ApiPropertyOptional({ example: 'Donate Blood, Save Lives' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ example: 'Join our nationwide blood donation drive' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  subtitle?: string;

  @ApiPropertyOptional({ example: 'Every drop counts. Join thousands of donors making a difference across the country.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'https://unique-ngo.com/blood-drive' })
  @IsOptional()
  @IsString()
  linkUrl?: string;

  @ApiPropertyOptional({ example: 'Learn More' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  buttonText?: string;

  @ApiPropertyOptional({ enum: banner_placement })
  @IsOptional()
  @IsEnum(banner_placement)
  placement?: banner_placement;

  @ApiPropertyOptional({ example: 'TOP', description: 'Position within the page, e.g. TOP, MIDDLE, BOTTOM' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  slot?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
