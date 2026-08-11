import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { appointment_status, blood_group } from '../../../generated/prisma/client';

export class ListAppointmentsQueryDto {
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

  @ApiPropertyOptional({ enum: appointment_status })
  @IsOptional()
  @IsEnum(appointment_status)
  status?: appointment_status;

  @ApiPropertyOptional({ description: 'Admin-only: filter to a specific donor' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ description: 'Admin-only: search by donor name, email or mobile' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Admin-only: filter to a specific hospital' })
  @IsOptional()
  @IsUUID()
  hospitalId?: string;

  @ApiPropertyOptional({ description: 'Admin-only: filter to a specific campaign' })
  @IsOptional()
  @IsUUID()
  campaignId?: string;
}

export class CreateAppointmentDto {
  @ApiPropertyOptional({ description: 'Book at a registered hospital (mutually exclusive with campaignId)' })
  @IsOptional()
  @IsUUID()
  hospitalId?: string;

  @ApiPropertyOptional({ description: 'Book at an active blood camp (mutually exclusive with hospitalId)' })
  @IsOptional()
  @IsUUID()
  campaignId?: string;

  @ApiProperty({ enum: blood_group })
  @IsEnum(blood_group)
  bloodGroup!: blood_group;

  @ApiProperty({ example: '2026-08-10' })
  @IsDateString()
  appointmentDate!: string;

  @ApiPropertyOptional({ example: '10:00 AM - 11:00 AM' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  timeSlot?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: '2026-05-01', description: 'Date of your last blood donation, if any. Falls back to your donation history if omitted.' })
  @IsOptional()
  @IsDateString()
  lastDonationDate?: string;

  @ApiProperty({ example: false, description: 'Eligibility question: have you had a tattoo recently?' })
  @Type(() => Boolean)
  @IsBoolean()
  hadTattooRecently!: boolean;

  @ApiPropertyOptional({ example: '2026-06-01', description: 'Required when hadTattooRecently is true' })
  @ValidateIf((dto: CreateAppointmentDto) => dto.hadTattooRecently)
  @IsDateString()
  tattooDate?: string;

  @ApiPropertyOptional({ example: true, default: true, description: 'Is this donation for the logged-in user, or on behalf of someone else?' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  forSelf?: boolean = true;

  @ApiPropertyOptional({ description: 'Required when forSelf is false: name of the person who will actually donate' })
  @ValidateIf((dto: CreateAppointmentDto) => dto.forSelf === false)
  @IsString()
  @MaxLength(255)
  beneficiaryName?: string;

  @ApiPropertyOptional({ description: 'Required when forSelf is false: mobile number of the person who will actually donate' })
  @ValidateIf((dto: CreateAppointmentDto) => dto.forSelf === false)
  @IsString()
  @MaxLength(20)
  beneficiaryMobile?: string;

  @ApiPropertyOptional({ example: 'Spouse', description: 'Required when forSelf is false: relationship to the logged-in user' })
  @ValidateIf((dto: CreateAppointmentDto) => dto.forSelf === false)
  @IsString()
  @MaxLength(100)
  beneficiaryRelation?: string;
}

export class UpdateAppointmentStatusDto {
  @ApiProperty({ enum: appointment_status })
  @IsEnum(appointment_status)
  status!: appointment_status;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cancelReason?: string;
}

export class AdminCreateAppointmentDto extends CreateAppointmentDto {
  @ApiProperty({ description: 'The donor this appointment is booked for' })
  @IsUUID()
  userId!: string;

  @ApiPropertyOptional({ description: 'Admin-created appointments skip the self-service eligibility gate' })
  @IsOptional()
  @IsBoolean()
  declare hadTattooRecently: boolean;
}

export class AdminUpdateAppointmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  hospitalId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  campaignId?: string;

  @ApiPropertyOptional({ enum: blood_group })
  @IsOptional()
  @IsEnum(blood_group)
  bloodGroup?: blood_group;

  @ApiPropertyOptional({ example: '2026-08-10' })
  @IsOptional()
  @IsDateString()
  appointmentDate?: string;

  @ApiPropertyOptional({ example: '10:00 AM - 11:00 AM' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  timeSlot?: string;

  @ApiPropertyOptional({ enum: appointment_status })
  @IsOptional()
  @IsEnum(appointment_status)
  status?: appointment_status;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cancelReason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  forSelf?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  beneficiaryName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  beneficiaryMobile?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  beneficiaryRelation?: string;
}
