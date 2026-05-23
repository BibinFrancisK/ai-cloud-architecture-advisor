import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { type Server } from 'http';
import request from 'supertest';
import { SessionModule } from '../../src/session/session.module';
import { ChatModule } from '../../src/chat/chat.module';
import { LlmService } from '../../src/llm/llm.service';
import { SessionStatus } from '../../src/common/types/session.types';
import { NextAction } from '../../src/common/types/chat.types';

interface SessionResponse {
  sessionId: string;
  status: SessionStatus;
  createdAt: string;
}

interface ChatResponse {
  sessionId: string;
  message: string;
  status: SessionStatus;
  completenessScore: number;
  clarificationRound: number;
  nextAction: NextAction;
}

const LOW_SCORE_OUTPUT = {
  SCALE: 0,
  LATENCY: 0,
  PERSISTENCE: 0,
  TEAM: 0,
  BUDGET: 0,
  COMPLIANCE: 0,
  questions: ['What scale do you expect?'],
  isComplete: false,
};

const HIGH_SCORE_OUTPUT = {
  SCALE: 2,
  LATENCY: 2,
  PERSISTENCE: 2,
  TEAM: 2,
  BUDGET: 2,
  COMPLIANCE: 2,
  questions: [],
  isComplete: true,
};

describe('Conversation flow', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const mockLlmService = {
      generateStructured: jest
        .fn()
        .mockResolvedValueOnce(LOW_SCORE_OUTPUT)
        .mockResolvedValue(HIGH_SCORE_OUTPUT),
      generate: jest.fn().mockResolvedValue({ text: 'mock', tokensUsed: 0 }),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [SessionModule, ChatModule],
    })
      .overrideProvider(LlmService)
      .useValue(mockLlmService)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /sessions returns 201 with a UUID sessionId and CLARIFYING status', async () => {
    const res = await request(app.getHttpServer() as Server)
      .post('/sessions')
      .expect(201);
    const body = res.body as SessionResponse;

    expect(body.sessionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(body.status).toBe(SessionStatus.CLARIFYING);
    expect(body.createdAt).toBeDefined();
  });

  describe('full clarification flow', () => {
    let sessionId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer() as Server)
        .post('/sessions')
        .expect(201);
      sessionId = (res.body as SessionResponse).sessionId;
    });

    it('returns CLARIFYING with a clarification question on a low-score first message', async () => {
      const res = await request(app.getHttpServer() as Server)
        .post(`/sessions/${sessionId}/chat`)
        .send({ message: 'I need a web application' })
        .expect(200);
      const body = res.body as ChatResponse;

      expect(body.sessionId).toBe(sessionId);
      expect(body.status).toBe(SessionStatus.CLARIFYING);
      expect(body.nextAction).toBe(NextAction.CONTINUE_CLARIFICATION);
      expect(body.completenessScore).toBeLessThan(70);
      expect(typeof body.message).toBe('string');
      expect(body.message.length).toBeGreaterThan(0);
      expect(typeof body.clarificationRound).toBe('number');
    });

    it('transitions to READY_TO_GENERATE once completeness score reaches the threshold', async () => {
      const res = await request(app.getHttpServer() as Server)
        .post(`/sessions/${sessionId}/chat`)
        .send({
          message:
            'We need 500 rps, p99 under 200ms, strong consistency, 5 engineers, fixed budget, GDPR compliance',
        })
        .expect(200);
      const body = res.body as ChatResponse;

      expect(body.sessionId).toBe(sessionId);
      expect(body.status).toBe(SessionStatus.READY_TO_GENERATE);
      expect(body.nextAction).toBe(NextAction.GENERATE_ARCHITECTURE);
      expect(body.completenessScore).toBeGreaterThanOrEqual(70);
    });
  });
});
