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
import { INDIAN_MOBILE_REPEATED_DIGITS_REGEX } from '../../common/constants';

export const HOSPITAL_NAME_REGEX = /^(?=.*\p{L})[\p{L}0-9 .,'\-&()/#]+$/u;
export const HOSPITAL_ADDRESS_REGEX = /^(?=.*\p{L})[\p{L}0-9 .,'\-&_/#()]+$/u;
export const PERSON_OR_PLACE_REGEX = /^(?=.*\p{L})[\p{L} .'\-]+$/u;
export const SAFE_NOTES_REGEX = /^(?!.*(?:<\s*script|\bscript\b|javascript:|data:\s*text\/html|on[a-z]+\s*=))[^<>]*$/is;

export const HOSPITAL_NAME_ERROR = "$property contains invalid characters. Only letters, digits, spaces, and valid symbols (. ' - & , ( ) / #) are allowed, and pure numbers are not allowed.";
export const HOSPITAL_ADDRESS_ERROR = "$property contains invalid characters. Only letters, digits, spaces, and valid symbols (, . ' - & _ / # ( )) are allowed, and pure numbers are not allowed.";
export const PERSON_OR_PLACE_ERROR = "$property contains invalid characters. Only letters, spaces, and valid symbols (. ' -) are allowed.";
export const SAFE_NOTES_ERROR = "$property cannot contain <, >, script, or event-handler patterns.";
export const MOBILE_ERROR = "Enter a valid 10-digit mobile number starting with 6, 7, 8, or 9 (repeated digits not allowed).";

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
  @Matches(PERSON_OR_PLACE_REGEX, { message: PERSON_OR_PLACE_ERROR })
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
  @Matches(HOSPITAL_NAME_REGEX, { message: HOSPITAL_NAME_ERROR })
  hospitalName!: string;

  @ApiProperty()
  @IsString()
  @Matches(HOSPITAL_ADDRESS_REGEX, { message: HOSPITAL_ADDRESS_ERROR })
  hospitalAddress!: string;

  @ApiProperty({ example: 'Pune' })
  @IsString()
  @MaxLength(100)
  @Matches(PERSON_OR_PLACE_REGEX, { message: PERSON_OR_PLACE_ERROR })
  city!: string;

  @ApiProperty({ example: 'Maharashtra' })
  @IsString()
  @MaxLength(100)
  @Matches(PERSON_OR_PLACE_REGEX, { message: PERSON_OR_PLACE_ERROR })
  state!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  @Matches(PERSON_OR_PLACE_REGEX, { message: PERSON_OR_PLACE_ERROR })
  contactName!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(20)
  @Matches(INDIAN_MOBILE_REPEATED_DIGITS_REGEX, { message: MOBILE_ERROR })
  contactMobile!: string;

  @ApiProperty({ example: '2026-08-15' })
  @IsDateString()
  requiredByDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(SAFE_NOTES_REGEX, { message: SAFE_NOTES_ERROR })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
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
  @Matches(PERSON_OR_PLACE_REGEX, { message: PERSON_OR_PLACE_ERROR })
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
  @Matches(PERSON_OR_PLACE_REGEX, { message: PERSON_OR_PLACE_ERROR })
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
  @Matches(HOSPITAL_NAME_REGEX, { message: HOSPITAL_NAME_ERROR })
  hospitalName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(HOSPITAL_ADDRESS_REGEX, { message: HOSPITAL_ADDRESS_ERROR })
  hospitalAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(PERSON_OR_PLACE_REGEX, { message: PERSON_OR_PLACE_ERROR })
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(PERSON_OR_PLACE_REGEX, { message: PERSON_OR_PLACE_ERROR })
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(PERSON_OR_PLACE_REGEX, { message: PERSON_OR_PLACE_ERROR })
  contactName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(INDIAN_MOBILE_REPEATED_DIGITS_REGEX, { message: MOBILE_ERROR })
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
  @MaxLength(500)
  @Matches(SAFE_NOTES_REGEX, { message: SAFE_NOTES_ERROR })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => normalizeBoolean(value))
  @IsBoolean()
  isEmergency?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(SAFE_NOTES_REGEX, { message: SAFE_NOTES_ERROR })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
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
  @Matches(PERSON_OR_PLACE_REGEX, { message: PERSON_OR_PLACE_ERROR })
  patientRelation?: string;
}
