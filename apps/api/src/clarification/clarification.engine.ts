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
    // Only target dimensions not yet fully answered (score < 2) so we never
    // repeat a question whose answer was already understood.
    const unanswered = [...assessment.scores]
      .filter((d) => d.score < 2)
      .sort((a, b) => a.score - b.score);

    // Fallback: if scoring somehow cleared everything, ask about the weakest.
    const pool =
      unanswered.length > 0
        ? unanswered
        : [...assessment.scores].sort((a, b) => a.score - b.score);

    const idx = round % pool.length;
    // Ask follow-up once we've cycled through all unanswered dimensions once.
    const useFollowUp = round >= pool.length;

    const dimension = pool[idx].dimension;
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
