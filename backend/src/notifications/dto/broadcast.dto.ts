import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, ArrayUnique, IsArray, IsEnum, IsString, MaxLength } from 'class-validator';
import { blood_group } from '../../../generated/prisma/client';

export class BroadcastByBloodGroupDto {
  @ApiProperty({ enum: blood_group, isArray: true, description: 'Send to users whose blood group is any of these' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(blood_group, { each: true })
  bloodGroups!: blood_group[];

  @ApiProperty({ example: 'Urgent: O- blood needed' })
  @IsString()
  @MaxLength(150)
  title!: string;

  @ApiProperty({ example: 'A patient near you urgently needs O- blood. Open the app to help.' })
  @IsString()
  body!: string;
}
