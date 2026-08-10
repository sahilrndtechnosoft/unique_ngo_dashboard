import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsInt, IsOptional, Min, ValidateIf } from 'class-validator';

export class CheckEligibilityDto {
  @ApiPropertyOptional({ example: '2026-05-01', description: 'Date of your last blood donation, if any. Falls back to your donation history if omitted.' })
  @IsOptional()
  @IsDateString()
  lastDonationDate?: string;

  @ApiProperty({ example: false })
  @Type(() => Boolean)
  @IsBoolean()
  hadTattooRecently!: boolean;

  @ApiPropertyOptional({ example: '2026-06-01', description: 'Required when hadTattooRecently is true' })
  @ValidateIf((dto: CheckEligibilityDto) => dto.hadTattooRecently)
  @IsDateString()
  tattooDate?: string;
}

export class UpdateEligibilitySettingsDto {
  @ApiPropertyOptional({ example: 3, description: 'Minimum months required since the last donation' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  donationEligibilityMonths?: number;

  @ApiPropertyOptional({ example: 6, description: 'Minimum months required since a tattoo' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  tattooEligibilityMonths?: number;
}
