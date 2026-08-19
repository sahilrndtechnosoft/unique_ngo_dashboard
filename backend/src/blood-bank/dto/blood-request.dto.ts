import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { blood_group, blood_request_status, urgency_level } from '../../../generated/prisma/client';

export class ListBloodRequestsQueryDto {
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

  @ApiPropertyOptional({ enum: blood_request_status })
  @IsOptional()
  @IsEnum(blood_request_status)
  status?: blood_request_status;

  @ApiPropertyOptional({ enum: urgency_level })
  @IsOptional()
  @IsEnum(urgency_level)
  urgency?: urgency_level;

  @ApiPropertyOptional({ enum: blood_group })
  @IsOptional()
  @IsEnum(blood_group)
  bloodGroup?: blood_group;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isEmergency?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}

export class CreateBloodRequestDto {
  @ApiProperty({ example: 'Ramesh Kumar' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  patientName!: string;

  @ApiProperty({ enum: blood_group })
  @IsEnum(blood_group)
  bloodGroup!: blood_group;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.5)
  unitsRequired?: number;

  @ApiPropertyOptional({ enum: urgency_level, example: urgency_level.MEDIUM })
  @IsOptional()
  @IsEnum(urgency_level)
  urgency?: urgency_level;

  @ApiProperty({ example: 'City Care Hospital' })
  @IsString()
  @MaxLength(255)
  hospitalName!: string;

  @ApiProperty()
  @IsString()
  hospitalAddress!: string;

  @ApiProperty({ example: 'Pune' })
  @IsString()
  @MaxLength(100)
  city!: string;

  @ApiProperty({ example: 'Maharashtra' })
  @IsString()
  @MaxLength(100)
  state!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  contactName!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(20)
  contactMobile!: string;

  @ApiProperty({ example: '2026-08-15' })
  @IsDateString()
  requiredByDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isEmergency?: boolean;

  @ApiPropertyOptional({ example: true, default: true, description: 'Is this request for the logged-in user, or on behalf of a family member?' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  forSelf?: boolean = true;

  @ApiPropertyOptional({ example: 'Spouse', description: 'Required when forSelf is false: relationship to the logged-in user' })
  @ValidateIf((dto: CreateBloodRequestDto) => dto.forSelf === false)
  @IsString()
  @MaxLength(100)
  patientRelation?: string;
}

export class AdminCreateBloodRequestDto extends CreateBloodRequestDto {
  @ApiProperty({ description: 'The user this blood request is raised for' })
  @IsUUID()
  userId!: string;
}

export class AdminUpdateBloodRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  patientName?: string;

  @ApiPropertyOptional({ enum: blood_group })
  @IsOptional()
  @IsEnum(blood_group)
  bloodGroup?: blood_group;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.5)
  unitsRequired?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitsFulfilled?: number;

  @ApiPropertyOptional({ enum: urgency_level })
  @IsOptional()
  @IsEnum(urgency_level)
  urgency?: urgency_level;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  hospitalName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hospitalAddress?: string;

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
  contactName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  contactMobile?: string;

  @ApiPropertyOptional({ example: '2026-08-15' })
  @IsOptional()
  @IsDateString()
  requiredByDate?: string;

  @ApiPropertyOptional({ enum: blood_request_status })
  @IsOptional()
  @IsEnum(blood_request_status)
  status?: blood_request_status;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isEmergency?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  adminNote?: string;

  @ApiPropertyOptional({ example: '2026-08-20' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  forSelf?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  patientRelation?: string;
}
