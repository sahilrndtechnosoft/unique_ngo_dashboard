import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  MinLength,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { INDIAN_MOBILE_REGEX } from '../../common/constants';
import { user_role, user_status } from '../../../generated/prisma/client';

const STAFF_ACCOUNT_TYPES: user_role[] = [
  user_role.ADMIN,
  user_role.SUPER_ADMIN,
];

export class ListUsersQueryDto {
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

  @ApiPropertyOptional({ example: 'john' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: user_role, description: 'Account type filter' })
  @IsOptional()
  @IsEnum(user_role)
  role?: user_role;

  @ApiPropertyOptional({ description: 'RBAC role filter' })
  @IsOptional()
  @IsUUID()
  rbacRoleId?: string;

  @ApiPropertyOptional({ enum: user_status })
  @IsOptional()
  @IsEnum(user_status)
  status?: user_status;
}

export class CreateAdminUserDto {
  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  fullName!: string;

  @ApiProperty({ example: 'jane@unique-ngo.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: '9876543210' })
  @IsOptional()
  @Matches(INDIAN_MOBILE_REGEX, {
    message: 'Mobile number must be a valid 10-digit Indian number',
  })
  mobile?: string;

  @ApiProperty({ example: 'Password123!' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({
    enum: user_role,
    example: user_role.USER,
    description: 'Portal account type',
  })
  @IsEnum(user_role)
  role!: user_role;

  @ApiPropertyOptional({
    description: 'Required when account type is ADMIN or SUPER_ADMIN',
  })
  @ValidateIf((dto: CreateAdminUserDto) =>
    STAFF_ACCOUNT_TYPES.includes(dto.role),
  )
  @IsUUID()
  rbacRoleId?: string;

  @ApiPropertyOptional({ enum: user_status, example: user_status.ACTIVE })
  @IsOptional()
  @IsEnum(user_status)
  status?: user_status;
}

export class UpdateAdminUserDto {
  @ApiPropertyOptional({ example: 'Jane Doe' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  fullName?: string;

  @ApiPropertyOptional({ example: 'jane@unique-ngo.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '9876543210' })
  @IsOptional()
  @Matches(INDIAN_MOBILE_REGEX, {
    message: 'Mobile number must be a valid 10-digit Indian number',
  })
  mobile?: string;

  @ApiPropertyOptional({ example: 'Password123!' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiPropertyOptional({
    enum: user_role,
    description: 'Portal account type',
  })
  @IsOptional()
  @IsEnum(user_role)
  role?: user_role;

  @ApiPropertyOptional({
    description:
      'RBAC role id; required when resulting account type is ADMIN or SUPER_ADMIN. Omit or null to clear for USER/SELLER.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  rbacRoleId?: string | null;

  @ApiPropertyOptional({ enum: user_status })
  @IsOptional()
  @IsEnum(user_status)
  status?: user_status;
}
