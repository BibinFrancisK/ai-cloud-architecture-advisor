import { Module } from '@nestjs/common';
import { ClarificationEngine } from './clarification.engine';
import { RequirementScorer } from './requirement.scorer';

@Module({
  providers: [RequirementScorer, ClarificationEngine],
  exports: [RequirementScorer, ClarificationEngine],
})
export class ClarificationModule {}
