import { Controller, Get, HttpCode, Logger, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { KnowledgeIngesterService } from './knowledge-ingester.service';
import { VectorStoreService } from './vector-store.service';

@ApiTags('admin')
@Controller('admin')
export class RagController {
  private readonly logger = new Logger(RagController.name);

  constructor(
    private readonly ingester: KnowledgeIngesterService,
    private readonly vectorStore: VectorStoreService,
  ) {}

  @Post('ingest')
  @HttpCode(202)
  @ApiOperation({
    summary: 'Trigger knowledge-base ingestion',
    description:
      'Clears existing chunks and re-ingests all Markdown files from the knowledge base. ' +
      'Returns 202 immediately — ingestion runs in the background (~80 s). ' +
      'Poll GET /admin/ingest/status to confirm completion.',
  })
  @ApiResponse({ status: 202, description: 'Ingestion started' })
  triggerIngest(): { message: string } {
    this.ingester
      .ingestAll()
      .catch((err: unknown) =>
        this.logger.error('Background ingestion failed', err),
      );
    return {
      message: 'Ingestion started — poll GET /admin/ingest/status for progress',
    };
  }

  @Get('ingest/status')
  @ApiOperation({
    summary: 'Ingestion status',
    description:
      'Returns the current number of chunks stored in the vector store.',
  })
  @ApiResponse({ status: 200, description: 'Current chunk count' })
  async getStatus(): Promise<{ chunks: number }> {
    const chunks = await this.vectorStore.getChunkCount();
    return { chunks };
  }
}
