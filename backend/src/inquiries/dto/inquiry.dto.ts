import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { inquiry_status } from '../../../generated/prisma/client';

export class CreateInquiryDto {
  @ApiPropertyOptional({ example: 'Jane Doe' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional({ example: 'jane@example.com' })
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiPropertyOptional({ example: '9876543210' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(20)
  mobile: string;

  @ApiPropertyOptional({ example: 'Question about blood donation eligibility' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  subject: string;

  @ApiPropertyOptional({ example: 'I would like to know...' })
  @IsNotEmpty()
  @IsString()
  message: string;
}

export class ListInquiriesQueryDto {
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

  @ApiPropertyOptional({ enum: inquiry_status })
  @IsOptional()
  @IsEnum(inquiry_status)
  status?: inquiry_status;

  @ApiPropertyOptional({ example: 'blood donation' })
  @IsOptional()
  @IsString()
  search?: string;
}

export class UpdateInquiryDto {
  @ApiPropertyOptional({ enum: inquiry_status })
  @IsOptional()
  @IsEnum(inquiry_status)
  status?: inquiry_status;

  @ApiPropertyOptional({ example: 'Called back and resolved the query.' })
  @IsOptional()
  @IsString()
  adminNote?: string;
}
