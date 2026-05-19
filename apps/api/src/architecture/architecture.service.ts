import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SessionService } from '../session/session.service';
import { RAGRetrieverService } from '../rag/rag-retriever.service';
import { ArchitectureGeneratorService } from './architecture-generator.service';
import { DiagramService } from './diagram.service';
import { SessionStatus } from '../common/types/session.types';
import type { ArchitectureRecommendation } from '../common/types/architecture.types';
import type { DiagramResponse } from '../common/types/diagram.types';

@Injectable()
export class ArchitectureService {
  private readonly logger = new Logger(ArchitectureService.name);

  constructor(
    private readonly sessionService: SessionService,
    private readonly ragRetriever: RAGRetrieverService,
    private readonly generator: ArchitectureGeneratorService,
    private readonly diagramService: DiagramService,
  ) {}

  async getOrGenerate(sessionId: string): Promise<ArchitectureRecommendation> {
    const session = this.sessionService.findById(sessionId);

    if (session.architecture) {
      return session.architecture;
    }

    if (session.status !== SessionStatus.READY_TO_GENERATE) {
      throw new BadRequestException(
        'Architecture can only be generated after requirements clarification is complete.',
      );
    }

    const start = Date.now();
    this.logger.log(
      `Generating architecture for session ${sessionId} (completeness: ${session.completenessScore})`,
    );

    const ragQuery = session.messages
      .filter((m) => m.role === 'user')
      .slice(-3)
      .map((m) => m.content)
      .join(' ');

    const ragChunks = await this.ragRetriever.retrieve(ragQuery, 5);

    if (ragChunks.length === 0) {
      this.logger.warn(
        `No RAG chunks retrieved for session ${sessionId} — generating without grounding`,
      );
    }

    const architecture = await this.generator.generate(
      session.messages,
      ragChunks,
    );

    session.architecture = architecture;
    session.status = SessionStatus.ARCHITECTURE_GENERATED;
    this.sessionService.save(session);

    this.logger.log(
      `Architecture generated for session ${sessionId}: ${architecture.services.length} services in ${Date.now() - start}ms`,
    );

    return architecture;
  }

  getDiagram(sessionId: string): DiagramResponse {
    const session = this.sessionService.findById(sessionId);

    if (!session.architecture) {
      throw new BadRequestException(
        'Architecture must be generated before a diagram can be retrieved.',
      );
    }

    return this.diagramService.getDiagram(session.architecture);
  }

  approve(sessionId: string): void {
    const session = this.sessionService.findById(sessionId);

    if (session.status !== SessionStatus.ARCHITECTURE_GENERATED) {
      throw new BadRequestException(
        'Architecture must be generated before it can be approved.',
      );
    }

    session.status = SessionStatus.ARCHITECTURE_APPROVED;
    this.sessionService.save(session);

    this.logger.log(`Architecture approved for session ${sessionId}`);
  }
}
