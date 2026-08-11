import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, ArrayUnique, IsArray, IsEnum, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';
import { blood_group } from '../../../generated/prisma/client';

export enum NotificationTarget {
  BLOOD_GROUP = 'BLOOD_GROUP',
  ALL_USERS = 'ALL_USERS',
  SPECIFIC_USERS = 'SPECIFIC_USERS',
}

export class SendNotificationDto {
  @ApiProperty({ enum: NotificationTarget })
  @IsEnum(NotificationTarget)
  target!: NotificationTarget;

  @ApiPropertyOptional({ enum: blood_group, isArray: true, description: 'Required when target is BLOOD_GROUP' })
  @ValidateIf((dto: SendNotificationDto) => dto.target === NotificationTarget.BLOOD_GROUP)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(blood_group, { each: true })
  bloodGroups?: blood_group[];

  @ApiPropertyOptional({ type: [String], description: 'Required when target is SPECIFIC_USERS' })
  @ValidateIf((dto: SendNotificationDto) => dto.target === NotificationTarget.SPECIFIC_USERS)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  userIds?: string[];

  @ApiProperty({ example: 'Urgent: O- blood needed' })
  @IsString()
  @MaxLength(150)
  title!: string;

  @ApiProperty({ example: 'A patient near you urgently needs O- blood. Open the app to help.' })
  @IsString()
  body!: string;
}
