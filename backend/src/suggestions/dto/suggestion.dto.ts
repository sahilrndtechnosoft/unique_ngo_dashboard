import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { suggestion_status } from '../../../generated/prisma/client';

export class CreateSuggestionDto {
  @ApiProperty({ example: 'PRODUCT' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  category!: string;

  @ApiProperty({ example: 'Add a wishlist sharing option' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @ApiProperty({ example: 'It would help families coordinate donations.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  details!: string;
}

export class ListSuggestionsQueryDto {
  @ApiPropertyOptional({ example: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @ApiPropertyOptional({ example: 20 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number = 20;
  @ApiPropertyOptional({ enum: suggestion_status }) @IsOptional() @IsEnum(suggestion_status) status?: suggestion_status;
  @ApiPropertyOptional({ example: 'wishlist' }) @IsOptional() @IsString() search?: string;
}

export class UpdateSuggestionDto {
  @ApiPropertyOptional({ enum: suggestion_status }) @IsOptional() @IsEnum(suggestion_status) status?: suggestion_status;
  @ApiPropertyOptional({ example: 'Added to the next planning cycle.' }) @IsOptional() @IsString() @MaxLength(5000) adminNote?: string;
}
