import {
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CdkGeneratorService } from './cdk-generator.service';
import { GenerateCdkDto } from './dto/generate-cdk.dto';
import { SessionService } from '../session/session.service';
import { SessionExistsGuard } from '../common/guards/session-exists.guard';
import { RequirementsCompleteGuard } from '../common/guards/requirements-complete.guard';
import type {
  CdkEnvironment,
  CdkGenerationMode,
  CdkGenerationResult,
} from '../common/types/cdk.types';
import { SessionStatus } from '../common/types/session.types';

@ApiTags('cdk')
@UseGuards(SessionExistsGuard, RequirementsCompleteGuard)
@Controller('sessions')
export class CdkController {
  constructor(
    private readonly cdkGeneratorService: CdkGeneratorService,
    private readonly sessionService: SessionService,
  ) {}

  @Post(':id/generate-cdk')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Generate CDK TypeScript code for an approved architecture',
    description:
      'Session must be in ARCHITECTURE_APPROVED status. Optionally pass "mode" (complete | skeleton) and "environment" (dev | staging | prod) in the request body.',
  })
  @ApiParam({ name: 'id', description: 'Session UUID' })
  @ApiBody({ type: GenerateCdkDto, required: false })
  @ApiResponse({
    status: 200,
    description: 'Generated CDK stack code and metadata',
  })
  @ApiResponse({ status: 403, description: 'Architecture not yet approved' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async generateCdk(
    @Param('id') sessionId: string,
    @Body() dto: GenerateCdkDto,
  ): Promise<CdkGenerationResult> {
    const session = this.sessionService.findById(sessionId);

    const mode: CdkGenerationMode =
      dto.mode ??
      (process.env.CDK_GENERATION_MODE as CdkGenerationMode | undefined) ??
      'complete';

    const environment: CdkEnvironment = dto.environment ?? 'dev';

    const result = await this.cdkGeneratorService.generate(
      session.architecture!,
      mode,
      environment,
    );

    this.sessionService.updateStatus(sessionId, SessionStatus.CDK_GENERATED);

    return result;
  }
}
