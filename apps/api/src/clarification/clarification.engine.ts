import { Injectable } from '@nestjs/common';
import type { RequirementsAssessment } from '../common/types/clarification.types';
import { CLARIFICATION_QUESTIONS } from './clarification.questions';

const SCORE_THRESHOLD = 70;
const MAX_ROUNDS = 5;

@Injectable()
export class ClarificationEngine {
  shouldContinueClarifying(score: number, round: number): boolean {
    return score < SCORE_THRESHOLD && round < MAX_ROUNDS;
  }

  selectQuestion(assessment: RequirementsAssessment, round: number): string {
    // Sort dimensions weakest-first so each round targets a different gap.
    const sorted = [...assessment.scores].sort((a, b) => a.score - b.score);
    const dimensionCount = sorted.length;

    const idx = round % dimensionCount;
    const useFollowUp = round >= dimensionCount;

    const dimension = sorted[idx].dimension;
    const entry = CLARIFICATION_QUESTIONS[dimension];
    return useFollowUp ? entry.followUp : entry.question;
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
