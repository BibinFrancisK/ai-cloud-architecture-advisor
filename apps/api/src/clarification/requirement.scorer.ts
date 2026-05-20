import { Injectable } from '@nestjs/common';
import type { ConversationMessage } from '../common/types/session.types';
import {
  DimensionScore,
  RequirementDimension,
  RequirementsAssessment,
} from '../common/types/clarification.types';

const MAX_DIMENSION_SCORE = 2;
const DIMENSION_COUNT = 6;
const MAX_TOTAL = MAX_DIMENSION_SCORE * DIMENSION_COUNT; // 12

@Injectable()
export class RequirementScorer {
  score(messages: ConversationMessage[]): RequirementsAssessment {
    const conversationText = messages.map((m) => m.content).join(' ');

    const scores: DimensionScore[] = Object.values(RequirementDimension).map(
      (dimension) => ({
        dimension,
        score: this.scoreDimension(dimension, conversationText),
      }),
    );

    const sum = scores.reduce((acc, d) => acc + d.score, 0);
    const totalScore = Math.round((sum / MAX_TOTAL) * 100);

    const lowestDimension = scores.reduce((lowest, current) =>
      current.score < lowest.score ? current : lowest,
    ).dimension;

    return { scores, totalScore, lowestDimension };
  }

  private scoreDimension(
    dimension: RequirementDimension,
    text: string,
  ): 0 | 1 | 2 {
    if (SCORE_2_PATTERNS[dimension].test(text)) return 2;
    if (SCORE_1_PATTERNS[dimension].test(text)) return 1;
    return 0;
  }
}

// Keywords that indicate a score-2 answer (specific, quantified)
const SCORE_2_PATTERNS: Record<RequirementDimension, RegExp> = {
  [RequirementDimension.SCALE]:
    /\b(\d[\d,]*[km]?\s*(rps|req(uests)?\/s(ec)?|rpm|tps|dau|mau|users?\/day|gb\/month|tb\/month)|\d[\d,]*[km]?\s*(?:daily|monthly)\s*(?:active\s*)?users?|\d+[km]?\s*concurrent|\d+[km]?\s*million)\b/i,
  [RequirementDimension.LATENCY]:
    /\b(p9[059]|p999|<\s*\d+\s*ms|\d+\s*ms|real[\s-]?time|sub[\s-]?second|latency\s*under|response\s*time\s*of)\b/i,
  [RequirementDimension.PERSISTENCE]:
    /\b(strong\s*consistency|eventual\s*consistency|acid|retention\s*of|\d+\s*(day|month|year)s?\s*retention|read[\s-]?heavy|write[\s-]?heavy|hot[\s-]?data|cold[\s-]?storage)\b/i,
  [RequirementDimension.TEAM]:
    /\b(\d+\s*(engineers?|devs?|sres?|devops|persons?|people)\s*(team)?|on[\s-]?call|kubernetes|k8s|ci\/cd\s*pipeline|zero[\s-]?downtime\s*deploy)\b/i,
  [RequirementDimension.BUDGET]:
    /\b(\$\d+|\d+\s*dollars?|per\s*month|monthly\s*budget|cost[\s-]?optimi[sz]|reserved\s*instance|savings\s*plan|spot\s*instance)\b/i,
  [RequirementDimension.COMPLIANCE]:
    /\b(gdpr|pci[\s-]?dss|soc\s*2|hipaa|iso\s*27001|fedramp|data\s*residency|eu[\s-]?region|single\s*region)\b/i,
};

// Keywords that indicate a score-1 answer (mentioned but vague)
const SCORE_1_PATTERNS: Record<RequirementDimension, RegExp> = {
  [RequirementDimension.SCALE]:
    /\b(traffic|users?|dau|mau|scale|load|high\s*volume|medium|millions?|thousands?|concurrent|requests?)\b/i,
  [RequirementDimension.LATENCY]:
    /\b(fast|quick|low\s*latency|responsive|performance|speed|slow|delay)\b/i,
  [RequirementDimension.PERSISTENCE]:
    /\b(database|storage|store|data|persist|rds|dynamo|s3|redis|cache|sql|nosql|relational)\b/i,
  [RequirementDimension.TEAM]:
    /\b(team|engineers?|developers?|devops|ops|small|large|startup|enterprise|managed\s*service)\b/i,
  [RequirementDimension.BUDGET]:
    /\b(budget|cost|cheap|expensive|affordable|free\s*tier|low\s*cost|price|spend)\b/i,
  [RequirementDimension.COMPLIANCE]:
    /\b(security|compliance|regulations?|privacy|secure|audit|certif\w*)\b/i,
};
