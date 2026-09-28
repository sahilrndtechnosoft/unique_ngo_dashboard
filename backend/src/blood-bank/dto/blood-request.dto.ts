import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { blood_group, blood_request_status, urgency_level } from '../../../generated/prisma/client';
import { INDIAN_MOBILE_REGEX } from '../../common/constants';

const BLOOD_REQUEST_LABEL_REGEX = /^(?=.*[A-Za-z])[A-Za-z .,'&_\/-]+$/;
const BLOOD_REQUEST_ADDRESS_REGEX = /^(?=.*[A-Za-z])[A-Za-z0-9 .,'&_\/-]+$/;
const BLOOD_REQUEST_TEXT_ERROR = "Field contains invalid characters. Only alphabets, spaces, and valid symbols (e.g., . ' - & _ /) are allowed.";

export function normalizeUrgency(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const normalized = value.trim().toUpperCase();
  return ({ NORMAL: 'MEDIUM', URGENT: 'HIGH' } as Record<string, string>)[normalized] ?? normalized;
}

function normalizeBoolean(value: unknown): unknown {
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  return value;
}

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
  @Transform(({ value }) => normalizeUrgency(value))
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
  @Transform(({ value }) => normalizeBoolean(value))
  @IsBoolean()
  isEmergency?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  search?: string;
}

export class CreateBloodRequestDto {
  @ApiProperty({ example: 'Ramesh Kumar' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  @Matches(BLOOD_REQUEST_LABEL_REGEX, { message: BLOOD_REQUEST_TEXT_ERROR })
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
  @Transform(({ value }) => normalizeUrgency(value))
  @IsEnum(urgency_level)
  urgency?: urgency_level;

  @ApiProperty({ example: 'City Care Hospital' })
  @IsString()
  @MaxLength(255)
  @Matches(BLOOD_REQUEST_LABEL_REGEX, { message: BLOOD_REQUEST_TEXT_ERROR })
  hospitalName!: string;

  @ApiProperty()
  @IsString()
  @Matches(BLOOD_REQUEST_ADDRESS_REGEX, { message: BLOOD_REQUEST_TEXT_ERROR })
  hospitalAddress!: string;

  @ApiProperty({ example: 'Pune' })
  @IsString()
  @MaxLength(100)
  @Matches(BLOOD_REQUEST_LABEL_REGEX, { message: BLOOD_REQUEST_TEXT_ERROR })
  city!: string;

  @ApiProperty({ example: 'Maharashtra' })
  @IsString()
  @MaxLength(100)
  @Matches(BLOOD_REQUEST_LABEL_REGEX, { message: BLOOD_REQUEST_TEXT_ERROR })
  state!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  @Matches(BLOOD_REQUEST_LABEL_REGEX, { message: BLOOD_REQUEST_TEXT_ERROR })
  contactName!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(20)
  @Matches(INDIAN_MOBILE_REGEX, { message: 'Enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.' })
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
  @Transform(({ value }) => normalizeBoolean(value))
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
  @Matches(BLOOD_REQUEST_LABEL_REGEX, { message: BLOOD_REQUEST_TEXT_ERROR })
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
  @Transform(({ value }) => normalizeUrgency(value))
  @IsEnum(urgency_level)
  urgency?: urgency_level;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(BLOOD_REQUEST_LABEL_REGEX, { message: BLOOD_REQUEST_TEXT_ERROR })
  hospitalName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(BLOOD_REQUEST_ADDRESS_REGEX, { message: BLOOD_REQUEST_TEXT_ERROR })
  hospitalAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(BLOOD_REQUEST_LABEL_REGEX, { message: BLOOD_REQUEST_TEXT_ERROR })
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(BLOOD_REQUEST_LABEL_REGEX, { message: BLOOD_REQUEST_TEXT_ERROR })
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(BLOOD_REQUEST_LABEL_REGEX, { message: BLOOD_REQUEST_TEXT_ERROR })
  contactName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(INDIAN_MOBILE_REGEX, { message: 'Enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.' })
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
  @Transform(({ value }) => normalizeBoolean(value))
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
