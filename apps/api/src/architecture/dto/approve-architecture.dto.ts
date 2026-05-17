import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ApproveArchitectureDto {
  @ApiProperty({ description: 'Whether the architecture is approved' })
  @IsBoolean()
  approved!: boolean;

  @ApiProperty({ required: false, description: 'Optional revision feedback' })
  @IsOptional()
  @IsString()
  feedback?: string;
}
