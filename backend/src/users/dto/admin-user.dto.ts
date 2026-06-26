import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  blood_group,
  user_role,
  user_status,
} from '../../../generated/prisma/client';
import { INDIAN_MOBILE_REGEX } from '../../common/constants';

export class ListUsersQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Search by name, email, or mobile' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: user_role })
  @IsOptional()
  @IsEnum(user_role)
  role?: user_role;

  @ApiPropertyOptional({ enum: user_status })
  @IsOptional()
  @IsEnum(user_status)
  status?: user_status;
}

export class AdminCreateUserDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @MinLength(2)
  fullName!: string;

  @ApiPropertyOptional({ example: 'user@example.com' })
  @ValidateIf((dto: AdminCreateUserDto) => !dto.mobile)
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email?: string;

  @ApiPropertyOptional({ example: '9876543210' })
  @ValidateIf((dto: AdminCreateUserDto) => !dto.email)
  @Matches(INDIAN_MOBILE_REGEX, {
    message: 'Mobile number must be a valid 10-digit Indian number',
  })
  mobile?: string;

  @ApiPropertyOptional({ example: 'Password123!' })
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password?: string;

  @ApiPropertyOptional({ enum: user_role, default: user_role.USER })
  @IsOptional()
  @IsEnum(user_role)
  role?: user_role;

  @ApiPropertyOptional({ enum: user_status, default: user_status.ACTIVE })
  @IsOptional()
  @IsEnum(user_status)
  status?: user_status;

  @ApiPropertyOptional({ enum: blood_group })
  @IsOptional()
  @IsEnum(blood_group)
  bloodGroup?: blood_group;
}

export class AdminUpdateUserDto {
  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;

  @ApiPropertyOptional({ example: 'user@example.com' })
  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email?: string;

  @ApiPropertyOptional({ example: '9876543210' })
  @IsOptional()
  @Matches(INDIAN_MOBILE_REGEX, {
    message: 'Mobile number must be a valid 10-digit Indian number',
  })
  mobile?: string;

  @ApiPropertyOptional({ example: 'NewPassword123!' })
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password?: string;

  @ApiPropertyOptional({ enum: user_role })
  @IsOptional()
  @IsEnum(user_role)
  role?: user_role;

  @ApiPropertyOptional({ enum: user_status })
  @IsOptional()
  @IsEnum(user_status)
  status?: user_status;

  @ApiPropertyOptional({ enum: blood_group })
  @IsOptional()
  @IsEnum(blood_group)
  bloodGroup?: blood_group;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  mobileVerified?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailVerified?: boolean;
}
