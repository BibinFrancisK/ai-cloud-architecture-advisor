import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import type {
  CdkEnvironment,
  CdkGenerationMode,
} from '../../common/types/cdk.types';

export class GenerateCdkDto {
  @ApiProperty({
    required: false,
    enum: ['complete', 'skeleton'],
    description:
      'Generation mode. "complete" produces a fully implemented stack; "skeleton" produces a scaffold with // TODO: guidance. Defaults to CDK_GENERATION_MODE env var, then "complete".',
  })
  @IsOptional()
  @IsIn(['complete', 'skeleton'])
  mode?: CdkGenerationMode;

  @ApiProperty({
    required: false,
    enum: ['dev', 'staging', 'prod'],
    description:
      'Target environment. Appended to the stack name (e.g. my-api-stack-prod). Defaults to "dev".',
  })
  @IsOptional()
  @IsIn(['dev', 'staging', 'prod'])
  environment?: CdkEnvironment;
}
