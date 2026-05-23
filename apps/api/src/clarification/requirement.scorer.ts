import { Injectable } from '@nestjs/common';
import type { ConversationMessage } from '../common/types/session.types';
import {
  type DimensionScore,
  RequirementDimension,
  type ClarificationAssessment,
  assessmentSchema,
  type AssessmentOutput,
  ASSESSMENT_SYSTEM_PROMPT,
} from '../common/types/clarification.types';
import { LlmService } from '../llm/llm.service';

const MAX_DIMENSION_SCORE = 2;
const DIMENSION_COUNT = 6;
const MAX_TOTAL = MAX_DIMENSION_SCORE * DIMENSION_COUNT;

@Injectable()
export class RequirementScorer {
  constructor(private readonly llmService: LlmService) {}

  async score(
    messages: ConversationMessage[],
  ): Promise<ClarificationAssessment> {
    const conversationHistory = messages.slice(0, -1);
    const lastMessage = messages.at(-1);
    const userMessage = lastMessage?.content ?? '';

    const raw = await this.llmService.generateStructured(
      {
        systemPrompt: ASSESSMENT_SYSTEM_PROMPT,
        conversationHistory,
        userMessage,
      },
      assessmentSchema,
    );

    return this.mapToAssessment(raw);
  }

  private mapToAssessment(raw: AssessmentOutput): ClarificationAssessment {
    const rawByDimension: Record<RequirementDimension, number> = {
      [RequirementDimension.SCALE]: raw.SCALE,
      [RequirementDimension.LATENCY]: raw.LATENCY,
      [RequirementDimension.PERSISTENCE]: raw.PERSISTENCE,
      [RequirementDimension.TEAM]: raw.TEAM,
      [RequirementDimension.BUDGET]: raw.BUDGET,
      [RequirementDimension.COMPLIANCE]: raw.COMPLIANCE,
    };

    const scores: DimensionScore[] = Object.values(RequirementDimension).map(
      (dimension) => ({
        dimension,
        score: Math.min(
          2,
          Math.max(0, Math.round(rawByDimension[dimension])),
        ) as 0 | 1 | 2,
      }),
    );

    const sum = scores.reduce((acc, d) => acc + d.score, 0);
    const totalScore = Math.round((sum / MAX_TOTAL) * 100);

    const lowestDimension = scores.reduce((lowest, current) =>
      current.score < lowest.score ? current : lowest,
    ).dimension;

    return {
      scores,
      totalScore,
      lowestDimension,
      pendingQuestions: raw.questions,
      isComplete: raw.isComplete,
    };
  }
}
