import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { page_type } from '../../../generated/prisma/client';

export class ListPagesQueryDto {
  @ApiPropertyOptional({ enum: page_type })
  @IsOptional()
  @IsEnum(page_type)
  type?: page_type;
}

export class CreatePageDto {
  @ApiPropertyOptional({ example: 'Blood Donation Policy' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({ enum: page_type })
  @IsEnum(page_type)
  type: page_type;

  @ApiPropertyOptional({ example: '<p>Policy content...</p>' })
  @IsNotEmpty()
  @IsString()
  content: string;

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

export class UpdatePageDto {
  @ApiPropertyOptional({ example: 'Blood Donation Policy' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ enum: page_type })
  @IsOptional()
  @IsEnum(page_type)
  type?: page_type;

  @ApiPropertyOptional({ example: '<p>Policy content...</p>' })
  @IsOptional()
  @IsString()
  content?: string;

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
