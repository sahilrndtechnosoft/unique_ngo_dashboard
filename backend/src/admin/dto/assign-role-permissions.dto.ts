import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class AssignRolePermissionsDto {
  @ApiProperty({
    type: [String],
    description: 'Permission IDs assigned to the role',
    example: [],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  permissionIds!: string[];
}
