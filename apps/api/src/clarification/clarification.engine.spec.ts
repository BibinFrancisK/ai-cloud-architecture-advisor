import { ClarificationEngine } from './clarification.engine';
import { CLARIFICATION_QUESTIONS } from './clarification.questions';
import {
  RequirementDimension,
  type RequirementsAssessment,
} from '../common/types/clarification.types';

function makeAssessment(
  overrides: Partial<Record<RequirementDimension, 0 | 1 | 2>> = {},
  lowestDimension = RequirementDimension.SCALE,
): RequirementsAssessment {
  const defaults: Record<RequirementDimension, 0 | 1 | 2> = {
    [RequirementDimension.SCALE]: 1,
    [RequirementDimension.LATENCY]: 1,
    [RequirementDimension.PERSISTENCE]: 1,
    [RequirementDimension.TEAM]: 1,
    [RequirementDimension.BUDGET]: 1,
    [RequirementDimension.COMPLIANCE]: 1,
  };
  const merged = { ...defaults, ...overrides };
  const scores = Object.values(RequirementDimension).map((d) => ({
    dimension: d,
    score: merged[d],
  }));
  const sum = scores.reduce((acc, s) => acc + s.score, 0);
  const totalScore = Math.round((sum / 12) * 100);
  return { scores, totalScore, lowestDimension };
}

describe('ClarificationEngine', () => {
  let engine: ClarificationEngine;

  beforeEach(() => {
    engine = new ClarificationEngine();
  });

  describe('shouldContinueClarifying', () => {
    it('returns true when score is below threshold and rounds remain', () => {
      expect(engine.shouldContinueClarifying(50, 2)).toBe(true);
    });

    it('returns false when score reaches the threshold', () => {
      expect(engine.shouldContinueClarifying(70, 2)).toBe(false);
    });

    it('returns false when score exceeds the threshold', () => {
      expect(engine.shouldContinueClarifying(85, 1)).toBe(false);
    });

    it('returns false when max rounds have been reached even if score is low', () => {
      expect(engine.shouldContinueClarifying(20, 5)).toBe(false);
    });
  });

  describe('selectQuestion', () => {
    it('returns the primary question for the lowest-scored dimension on round 0', () => {
      const assessment = makeAssessment(
        { [RequirementDimension.SCALE]: 0 },
        RequirementDimension.SCALE,
      );
      const question = engine.selectQuestion(assessment, 0);
      expect(question).toBe(
        CLARIFICATION_QUESTIONS[RequirementDimension.SCALE].question,
      );
    });

    it('returns the follow-up question after cycling through all unanswered dimensions', () => {
      // All 6 dimensions at score 1 (unanswered), round 6 → useFollowUp = true
      const assessment = makeAssessment({}, RequirementDimension.SCALE);
      const unansweredCount = 6;
      const question = engine.selectQuestion(assessment, unansweredCount);
      // round >= pool.length triggers follow-up; idx = round % pool.length = 0
      const firstDimension = assessment.scores
        .filter((s) => s.score < 2)
        .sort((a, b) => a.score - b.score)[0].dimension;
      expect(question).toBe(CLARIFICATION_QUESTIONS[firstDimension].followUp);
    });

    it('skips dimensions already scored 2 when selecting the next question', () => {
      // SCALE=2 (answered), all others=0; lowest unanswered should be picked
      const assessment = makeAssessment(
        {
          [RequirementDimension.SCALE]: 2,
          [RequirementDimension.LATENCY]: 0,
          [RequirementDimension.PERSISTENCE]: 0,
          [RequirementDimension.TEAM]: 0,
          [RequirementDimension.BUDGET]: 0,
          [RequirementDimension.COMPLIANCE]: 0,
        },
        RequirementDimension.LATENCY,
      );
      const question = engine.selectQuestion(assessment, 0);
      // SCALE is excluded (score 2); first of the remaining should be asked
      expect(question).not.toBe(
        CLARIFICATION_QUESTIONS[RequirementDimension.SCALE].question,
      );
      expect(question).not.toBe(
        CLARIFICATION_QUESTIONS[RequirementDimension.SCALE].followUp,
      );
    });
  });

  describe('buildReadyMessage', () => {
    it('includes the numeric completeness score in the message', () => {
      const assessment = makeAssessment({}, RequirementDimension.COMPLIANCE);
      const message = engine.buildReadyMessage(assessment);
      expect(message).toContain(String(assessment.totalScore));
    });
  });
});
