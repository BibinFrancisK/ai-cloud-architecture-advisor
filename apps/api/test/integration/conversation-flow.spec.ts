import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { type Server } from 'http';
import request from 'supertest';
import { SessionModule } from '../../src/session/session.module';
import { ChatModule } from '../../src/chat/chat.module';
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

// One message that scores 2 on all six requirement dimensions (total = 100).
// Used to drive the session past the 70-point threshold in a single turn.
const RICH_MESSAGE =
  'We expect 500 rps at peak. p99 under 200ms is required. ' +
  'We need strong consistency. 5 engineers on the team. ' +
  'Monthly budget per month. GDPR compliance required.';

describe('Conversation flow', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [SessionModule, ChatModule],
    }).compile();

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
        .send({ message: RICH_MESSAGE })
        .expect(200);
      const body = res.body as ChatResponse;

      expect(body.sessionId).toBe(sessionId);
      expect(body.status).toBe(SessionStatus.READY_TO_GENERATE);
      expect(body.nextAction).toBe(NextAction.GENERATE_ARCHITECTURE);
      expect(body.completenessScore).toBeGreaterThanOrEqual(70);
    });
  });
});
