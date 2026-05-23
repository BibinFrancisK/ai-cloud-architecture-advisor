import { Module } from '@nestjs/common';
import { ClarificationEngine } from './clarification.engine';
import { RequirementScorer } from './requirement.scorer';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [LlmModule],
  providers: [RequirementScorer, ClarificationEngine],
  exports: [RequirementScorer, ClarificationEngine],
})
export class ClarificationModule {}
