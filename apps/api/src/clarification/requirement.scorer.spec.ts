import { RequirementScorer } from './requirement.scorer';
import type { ConversationMessage } from '../common/types/session.types';
import { RequirementDimension } from '../common/types/clarification.types';

function msg(content: string): ConversationMessage {
  return { role: 'user', content, timestamp: new Date() };
}

describe('RequirementScorer', () => {
  let scorer: RequirementScorer;

  beforeEach(() => {
    scorer = new RequirementScorer();
  });

  it('returns totalScore 0 and a valid lowestDimension when messages are empty', () => {
    const result = scorer.score([]);
    expect(result.totalScore).toBe(0);
    expect(Object.values(RequirementDimension)).toContain(
      result.lowestDimension,
    );
  });

  describe('SCALE dimension', () => {
    it('scores 0 when scale is not mentioned', () => {
      const result = scorer.score([msg('I need a simple web application')]);
      const dim = result.scores.find(
        (s) => s.dimension === RequirementDimension.SCALE,
      );
      expect(dim?.score).toBe(0);
    });

    it('scores 1 when scale is mentioned vaguely', () => {
      const result = scorer.score([
        msg('We expect high traffic from many users'),
      ]);
      const dim = result.scores.find(
        (s) => s.dimension === RequirementDimension.SCALE,
      );
      expect(dim?.score).toBe(1);
    });

    it('scores 2 when scale is specified with an exact RPS figure', () => {
      const result = scorer.score([msg('We expect 200 rps at peak load')]);
      const dim = result.scores.find(
        (s) => s.dimension === RequirementDimension.SCALE,
      );
      expect(dim?.score).toBe(2);
    });
  });

  describe('LATENCY dimension', () => {
    it('scores 0 when latency is not mentioned', () => {
      const result = scorer.score([msg('I need a simple web application')]);
      const dim = result.scores.find(
        (s) => s.dimension === RequirementDimension.LATENCY,
      );
      expect(dim?.score).toBe(0);
    });

    it('scores 1 when latency is mentioned vaguely', () => {
      const result = scorer.score([
        msg('The application needs to be fast and responsive'),
      ]);
      const dim = result.scores.find(
        (s) => s.dimension === RequirementDimension.LATENCY,
      );
      expect(dim?.score).toBe(1);
    });

    it('scores 2 when a specific p99 target is stated', () => {
      const result = scorer.score([
        msg('We need p99 under 200ms response time'),
      ]);
      const dim = result.scores.find(
        (s) => s.dimension === RequirementDimension.LATENCY,
      );
      expect(dim?.score).toBe(2);
    });
  });

  describe('PERSISTENCE dimension', () => {
    it('scores 0 when persistence is not mentioned', () => {
      const result = scorer.score([msg('I need a simple web application')]);
      const dim = result.scores.find(
        (s) => s.dimension === RequirementDimension.PERSISTENCE,
      );
      expect(dim?.score).toBe(0);
    });

    it('scores 1 when a storage type is mentioned without details', () => {
      const result = scorer.score([
        msg('We need a database for our application'),
      ]);
      const dim = result.scores.find(
        (s) => s.dimension === RequirementDimension.PERSISTENCE,
      );
      expect(dim?.score).toBe(1);
    });

    it('scores 2 when the consistency model is specified', () => {
      const result = scorer.score([
        msg('We require strong consistency for all writes'),
      ]);
      const dim = result.scores.find(
        (s) => s.dimension === RequirementDimension.PERSISTENCE,
      );
      expect(dim?.score).toBe(2);
    });
  });

  describe('TEAM dimension', () => {
    it('scores 0 when team information is not mentioned', () => {
      const result = scorer.score([msg('I need a simple web application')]);
      const dim = result.scores.find(
        (s) => s.dimension === RequirementDimension.TEAM,
      );
      expect(dim?.score).toBe(0);
    });

    it('scores 1 when team size is mentioned without a specific number', () => {
      const result = scorer.score([
        msg('We have a small team and prefer managed services'),
      ]);
      const dim = result.scores.find(
        (s) => s.dimension === RequirementDimension.TEAM,
      );
      expect(dim?.score).toBe(1);
    });

    it('scores 2 when team size is given as a specific number', () => {
      const result = scorer.score([msg('We are a team of 5 engineers')]);
      const dim = result.scores.find(
        (s) => s.dimension === RequirementDimension.TEAM,
      );
      expect(dim?.score).toBe(2);
    });
  });

  describe('BUDGET dimension', () => {
    it('scores 0 when budget is not mentioned', () => {
      const result = scorer.score([msg('I need a simple web application')]);
      const dim = result.scores.find(
        (s) => s.dimension === RequirementDimension.BUDGET,
      );
      expect(dim?.score).toBe(0);
    });

    it('scores 1 when cost concern is mentioned without an amount', () => {
      const result = scorer.score([
        msg('We need to stay within our budget and keep costs low'),
      ]);
      const dim = result.scores.find(
        (s) => s.dimension === RequirementDimension.BUDGET,
      );
      expect(dim?.score).toBe(1);
    });

    it('scores 2 when a specific monthly spend is stated', () => {
      const result = scorer.score([
        msg('Our monthly budget is around $3000 per month'),
      ]);
      const dim = result.scores.find(
        (s) => s.dimension === RequirementDimension.BUDGET,
      );
      expect(dim?.score).toBe(2);
    });
  });

  describe('COMPLIANCE dimension', () => {
    it('scores 0 when compliance is not mentioned', () => {
      const result = scorer.score([msg('I need a simple web application')]);
      const dim = result.scores.find(
        (s) => s.dimension === RequirementDimension.COMPLIANCE,
      );
      expect(dim?.score).toBe(0);
    });

    it('scores 1 when security is mentioned without a specific framework', () => {
      const result = scorer.score([
        msg('We have strict security and compliance requirements'),
      ]);
      const dim = result.scores.find(
        (s) => s.dimension === RequirementDimension.COMPLIANCE,
      );
      expect(dim?.score).toBe(1);
    });

    it('scores 2 when a specific compliance standard is cited', () => {
      const result = scorer.score([
        msg('We must comply with GDPR and store data in the EU region'),
      ]);
      const dim = result.scores.find(
        (s) => s.dimension === RequirementDimension.COMPLIANCE,
      );
      expect(dim?.score).toBe(2);
    });
  });

  it('returns totalScore 100 when all six dimensions are fully specified', () => {
    const result = scorer.score([
      msg('We expect 200 rps at peak'),
      msg('p99 under 200ms response'),
      msg('strong consistency needed'),
      msg('5 engineers on the team'),
      msg('per month budget allocated'),
      msg('GDPR compliance required'),
    ]);
    expect(result.totalScore).toBe(100);
  });

  it('sets lowestDimension to the dimension with the lowest score', () => {
    const result = scorer.score([
      msg('We expect traffic from many users'),
      msg('fast response needed'),
      msg('we have a database'),
      msg('small team'),
      msg('our budget is limited'),
      // COMPLIANCE intentionally omitted — should be the lowest at score 0
    ]);
    expect(result.lowestDimension).toBe(RequirementDimension.COMPLIANCE);
  });
});
