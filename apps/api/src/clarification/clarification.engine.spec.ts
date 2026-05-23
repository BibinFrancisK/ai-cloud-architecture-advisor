import { ClarificationEngine } from './clarification.engine';
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
    it('returns true when batch count is below max and requirements are not complete', () => {
      expect(engine.shouldContinueClarifying(2, false)).toBe(true);
    });

    it('returns false when requirements are complete regardless of batch count', () => {
      expect(engine.shouldContinueClarifying(1, true)).toBe(false);
    });

    it('returns false when max batches (4) are reached even if requirements are incomplete', () => {
      expect(engine.shouldContinueClarifying(4, false)).toBe(false);
    });

    it('returns true when batch is at 3 (just below max) and not complete', () => {
      expect(engine.shouldContinueClarifying(3, false)).toBe(true);
    });

    it('returns false when both conditions are met (max batches and complete)', () => {
      expect(engine.shouldContinueClarifying(4, true)).toBe(false);
    });
  });

  describe('buildReadyMessage', () => {
    it('includes the numeric completeness score in the message', () => {
      const assessment = makeAssessment({}, RequirementDimension.COMPLIANCE);
      const message = engine.buildReadyMessage(assessment);
      expect(message).toContain(String(assessment.totalScore));
    });

    it('mentions architecture generation in the message', () => {
      const assessment = makeAssessment({}, RequirementDimension.COMPLIANCE);
      const message = engine.buildReadyMessage(assessment);
      expect(message.toLowerCase()).toContain('architecture');
    });
  });
});
