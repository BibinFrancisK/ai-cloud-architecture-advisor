import { z } from 'zod';

export const SCORE_THRESHOLD = 70;

export const assessmentSchema = z.object({
  SCALE: z.number().min(0).max(2),
  LATENCY: z.number().min(0).max(2),
  PERSISTENCE: z.number().min(0).max(2),
  TEAM: z.number().min(0).max(2),
  BUDGET: z.number().min(0).max(2),
  COMPLIANCE: z.number().min(0).max(2),
  questions: z
    .array(z.string())
    .describe(
      'Contextual follow-up questions for dimensions scored below 2. Empty if all dimensions are covered.',
    ),
  isComplete: z
    .boolean()
    .describe(
      `True when all dimensions are sufficiently covered and totalScore >= ${SCORE_THRESHOLD}`,
    ),
});

export type AssessmentOutput = z.infer<typeof assessmentSchema>;

export const ASSESSMENT_SYSTEM_PROMPT = `You are an expert requirements analyst for AWS cloud architecture projects.

Analyze the conversation history and score each requirement dimension on a 0–2 scale:
  0 = Not mentioned at all
  1 = Mentioned vaguely (e.g. "fast", "big team", "some budget")
  2 = Specified concretely (e.g. "200 RPS", "5 engineers", "$3 000/month", "p99 < 200ms")

Dimensions:
  SCALE       — traffic volume (RPS, DAU, data volume in GB/month)
  LATENCY     — response time requirements (p99, real-time, batch)
  PERSISTENCE — data storage type, read/write patterns, consistency, retention
  TEAM        — team size and DevOps maturity (managed services vs. Kubernetes)
  BUDGET      — monthly infrastructure budget and cost optimisation priority
  COMPLIANCE  — regulatory requirements (GDPR, PCI-DSS, SOC 2, HIPAA, data residency)

Then provide a list of specific follow-up questions for every dimension still scored below 2.
Questions must be tailored to what the user has already said — never ask about something they have already clarified.
If all dimensions score 2 (or the conversation provides enough signal for a complete architecture), set isComplete to true and return an empty questions array.`;

export enum RequirementDimension {
  SCALE = 'SCALE',
  LATENCY = 'LATENCY',
  PERSISTENCE = 'PERSISTENCE',
  TEAM = 'TEAM',
  BUDGET = 'BUDGET',
  COMPLIANCE = 'COMPLIANCE',
}

export interface DimensionScore {
  dimension: RequirementDimension;
  score: 0 | 1 | 2;
}

export interface RequirementsAssessment {
  scores: DimensionScore[];
  totalScore: number;
  lowestDimension: RequirementDimension;
}

export interface ClarificationAssessment extends RequirementsAssessment {
  pendingQuestions: string[];
  isComplete: boolean;
}
