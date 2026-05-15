import { Injectable, NotFoundException } from '@nestjs/common';
import { SessionState, SessionStatus } from '../common/types/session.types';

@Injectable()
export class SessionService {
  private readonly sessions = new Map<string, SessionState>();

  create(): SessionState {
    const session: SessionState = {
      id: crypto.randomUUID(),
      status: SessionStatus.CLARIFYING,
      messages: [],
      clarificationRound: 0,
      completenessScore: 0,
      createdAt: new Date(),
    };
    this.sessions.set(session.id, session);
    return session;
  }

  findById(id: string): SessionState {
    const session = this.sessions.get(id);
    if (!session) {
      throw new NotFoundException(`Session ${id} not found`);
    }
    return session;
  }
}
