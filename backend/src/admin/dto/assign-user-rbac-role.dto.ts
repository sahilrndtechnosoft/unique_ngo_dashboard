import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, ValidateIf } from 'class-validator';

export class AssignUserRbacRoleDto {
  @ApiPropertyOptional({
    description: 'RBAC role ID to assign. Pass null to remove assignment.',
    nullable: true,
  })
  @ValidateIf((_obj, value) => value !== null)
  @IsOptional()
  @IsUUID('4')
  roleId!: string | null;
}
