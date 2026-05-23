import { Injectable } from '@nestjs/common';
import type { RequirementsAssessment } from '../common/types/clarification.types';

const MAX_BATCHES = 4;

@Injectable()
export class ClarificationEngine {
  shouldContinueClarifying(batch: number, isComplete: boolean): boolean {
    return !isComplete && batch < MAX_BATCHES;
  }

  buildReadyMessage(assessment: RequirementsAssessment): string {
    return (
      `I now have enough information to generate your architecture recommendation. ` +
      `Your requirements completeness score is ${assessment.totalScore}/100. ` +
      `When you're ready, ask me to generate the architecture and I'll produce a detailed ` +
      `AWS recommendation with tradeoff analysis and a Mermaid diagram.`
    );
  }
}
