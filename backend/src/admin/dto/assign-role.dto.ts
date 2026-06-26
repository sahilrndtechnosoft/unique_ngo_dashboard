import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { UserRole } from '../../common/constants';

export class AssignRoleDto {
  @ApiProperty({ example: UserRole.SELLER, enum: UserRole })
  @IsEnum(UserRole, { message: 'Invalid role' })
  role!: UserRole;
}
