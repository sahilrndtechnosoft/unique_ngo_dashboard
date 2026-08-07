import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
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
}
