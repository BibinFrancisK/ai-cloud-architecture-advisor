import {
  Body,
  Controller,
  Get,
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
import { ArchitectureService } from './architecture.service';
import { ArchitectureRecommendationDto } from './dto/architecture-response.dto';
import { ApproveArchitectureDto } from './dto/approve-architecture.dto';
import { SessionExistsGuard } from '../common/guards/session-exists.guard';
import { SessionStatus } from '../common/types/session.types';

@ApiTags('architecture')
@UseGuards(SessionExistsGuard)
@Controller('sessions')
export class ArchitectureController {
  constructor(private readonly architectureService: ArchitectureService) {}

  @Get(':id/architecture')
  @ApiOperation({
    summary: 'Get or generate the architecture recommendation for a session',
    description:
      'Triggers generation on first call (session must be READY_TO_GENERATE). Returns cached result on subsequent calls.',
  })
  @ApiParam({ name: 'id', description: 'Session UUID' })
  @ApiResponse({ status: 200, type: ArchitectureRecommendationDto })
  @ApiResponse({ status: 400, description: 'Clarification not yet complete' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  getArchitecture(@Param('id') sessionId: string) {
    return this.architectureService.getOrGenerate(sessionId);
  }

  @Post(':id/architecture/approve')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Approve the generated architecture',
    description:
      'Transitions session to ARCHITECTURE_APPROVED, unlocking CDK generation.',
  })
  @ApiParam({ name: 'id', description: 'Session UUID' })
  @ApiBody({ type: ApproveArchitectureDto })
  @ApiResponse({ status: 200, description: 'Approval status' })
  @ApiResponse({ status: 400, description: 'Architecture not yet generated' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  approve(
    @Param('id') sessionId: string,
    @Body() dto: ApproveArchitectureDto,
  ): { sessionId: string; status: SessionStatus } {
    if (dto.approved) {
      this.architectureService.approve(sessionId);
    }

    return {
      sessionId,
      status: dto.approved
        ? SessionStatus.ARCHITECTURE_APPROVED
        : SessionStatus.ARCHITECTURE_GENERATED,
    };
  }
}
