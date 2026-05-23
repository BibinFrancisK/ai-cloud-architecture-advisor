import { RequirementScorer } from './requirement.scorer';
import { LlmService } from '../llm/llm.service';
import type { ConversationMessage } from '../common/types/session.types';
import { RequirementDimension } from '../common/types/clarification.types';

function msg(
  content: string,
  role: 'user' | 'assistant' = 'user',
): ConversationMessage {
  return { role, content, timestamp: new Date() };
}

const ALL_ZEROS = {
  SCALE: 0,
  LATENCY: 0,
  PERSISTENCE: 0,
  TEAM: 0,
  BUDGET: 0,
  COMPLIANCE: 0,
  questions: [],
  isComplete: false,
};

const ALL_TWOS = {
  SCALE: 2,
  LATENCY: 2,
  PERSISTENCE: 2,
  TEAM: 2,
  BUDGET: 2,
  COMPLIANCE: 2,
  questions: [],
  isComplete: true,
};

describe('RequirementScorer', () => {
  let scorer: RequirementScorer;
  let mockLlmService: { generateStructured: jest.Mock };

  beforeEach(() => {
    mockLlmService = { generateStructured: jest.fn() };
    scorer = new RequirementScorer(mockLlmService as unknown as LlmService);
  });

  it('returns totalScore 0 and a valid lowestDimension when LLM scores all dimensions 0', async () => {
    mockLlmService.generateStructured.mockResolvedValue({ ...ALL_ZEROS });
    const result = await scorer.score([msg('I need a web app')]);
    expect(result.totalScore).toBe(0);
    expect(Object.values(RequirementDimension)).toContain(
      result.lowestDimension,
    );
  });

  it('returns totalScore 100 when LLM scores all dimensions 2', async () => {
    mockLlmService.generateStructured.mockResolvedValue({ ...ALL_TWOS });
    const result = await scorer.score([msg('detailed requirements')]);
    expect(result.totalScore).toBe(100);
  });

  it('computes totalScore correctly from mixed dimension scores', async () => {
    // SCALE=2, LATENCY=1, rest=0 → sum=3, max=12 → round(3/12*100) = 25
    mockLlmService.generateStructured.mockResolvedValue({
      ...ALL_ZEROS,
      SCALE: 2,
      LATENCY: 1,
    });
    const result = await scorer.score([
      msg('We expect 200 rps and need low latency'),
    ]);
    expect(result.totalScore).toBe(25);
  });

  it('sets lowestDimension to the dimension with the lowest score', async () => {
    mockLlmService.generateStructured.mockResolvedValue({
      ...ALL_TWOS,
      COMPLIANCE: 0,
      isComplete: false,
    });
    const result = await scorer.score([msg('all covered except compliance')]);
    expect(result.lowestDimension).toBe(RequirementDimension.COMPLIANCE);
  });

  it('passes pendingQuestions from LLM response through unchanged', async () => {
    const questions = [
      'What is your expected RPS?',
      'What is your p99 latency target?',
    ];
    mockLlmService.generateStructured.mockResolvedValue({
      ...ALL_ZEROS,
      questions,
    });
    const result = await scorer.score([msg('I need a web app')]);
    expect(result.pendingQuestions).toEqual(questions);
  });

  it('passes isComplete: true from LLM response through unchanged', async () => {
    mockLlmService.generateStructured.mockResolvedValue({ ...ALL_TWOS });
    const result = await scorer.score([msg('full requirements')]);
    expect(result.isComplete).toBe(true);
  });

  it('passes isComplete: false from LLM response through unchanged', async () => {
    mockLlmService.generateStructured.mockResolvedValue({ ...ALL_ZEROS });
    const result = await scorer.score([msg('vague requirements')]);
    expect(result.isComplete).toBe(false);
  });

  it('scores array contains an entry for every RequirementDimension', async () => {
    mockLlmService.generateStructured.mockResolvedValue({ ...ALL_ZEROS });
    const result = await scorer.score([msg('I need a web app')]);
    const dimensions = result.scores.map((s) => s.dimension);
    Object.values(RequirementDimension).forEach((d) => {
      expect(dimensions).toContain(d);
    });
  });

  it('clamps out-of-range LLM values to 0-2', async () => {
    mockLlmService.generateStructured.mockResolvedValue({
      ...ALL_ZEROS,
      SCALE: 5, // above max → clamp to 2
      LATENCY: -1, // below min → clamp to 0
    });
    const result = await scorer.score([msg('edge case')]);
    const scale = result.scores.find(
      (s) => s.dimension === RequirementDimension.SCALE,
    );
    const latency = result.scores.find(
      (s) => s.dimension === RequirementDimension.LATENCY,
    );
    expect(scale?.score).toBe(2);
    expect(latency?.score).toBe(0);
  });

  it('sends the last message as userMessage and the rest as conversationHistory', async () => {
    mockLlmService.generateStructured.mockResolvedValue({ ...ALL_ZEROS });
    const messages = [
      msg('First message'),
      msg('AI reply', 'assistant'),
      msg('Second user message'),
    ];
    await scorer.score(messages);

    expect(mockLlmService.generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        userMessage: 'Second user message',
        conversationHistory: expect.arrayContaining([
          expect.objectContaining({ content: 'First message' }),
          expect.objectContaining({ content: 'AI reply' }),
        ]) as unknown,
      }),
      expect.anything(),
    );
  });
});
