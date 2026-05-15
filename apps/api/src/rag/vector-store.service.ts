import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Pool } from 'pg';
import { KnowledgeChunkInput, SearchResult } from '../common/types/rag.types';
import {
  CLEAR_ALL,
  GET_CHUNK_COUNT,
  SIMILARITY_SEARCH,
  UPSERT_CHUNK,
} from './vector-store.queries';

@Injectable()
export class VectorStoreService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VectorStoreService.name);
  private pool!: Pool;

  onModuleInit(): void {
    this.pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  async upsertChunk(chunk: KnowledgeChunkInput): Promise<void> {
    const embeddingLiteral = `[${chunk.embedding.join(',')}]`;
    await this.pool.query(UPSERT_CHUNK, [
      chunk.content,
      chunk.sourceFile,
      chunk.chunkIndex,
      JSON.stringify(chunk.metadata ?? {}),
      embeddingLiteral,
    ]);
  }

  async similaritySearch(
    queryEmbedding: number[],
    topK: number,
  ): Promise<SearchResult[]> {
    const embeddingLiteral = `[${queryEmbedding.join(',')}]`;
    const result = await this.pool.query<{
      id: string;
      content: string;
      source_file: string;
      chunk_index: number;
      metadata: Record<string, unknown> | null;
      similarity: number;
    }>(SIMILARITY_SEARCH, [embeddingLiteral, topK]);
    return result.rows.map((row) => ({
      id: row.id,
      content: row.content,
      sourceFile: row.source_file,
      chunkIndex: row.chunk_index,
      metadata: row.metadata,
      similarity: Number(row.similarity),
    }));
  }

  async clearAll(): Promise<void> {
    await this.pool.query(CLEAR_ALL);
    this.logger.log('Cleared all knowledge chunks');
  }

  async getChunkCount(): Promise<number> {
    const result = await this.pool.query<{ count: string }>(GET_CHUNK_COUNT);
    return parseInt(result.rows[0].count, 10);
  }
}
