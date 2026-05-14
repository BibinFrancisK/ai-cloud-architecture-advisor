import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { RetrievedChunk } from './types/rag.types';
import { VectorStoreService } from './vector-store.service';
import { EMBEDDING_MODEL } from './rag.constants';

@Injectable()
export class RAGRetrieverService implements OnModuleInit {
  private readonly logger = new Logger(RAGRetrieverService.name);
  private embeddingModel!: GenerativeModel;

  constructor(private readonly vectorStore: VectorStoreService) {}

  onModuleInit(): void {
    this.embeddingModel = new GoogleGenerativeAI(
      process.env.GEMINI_API_KEY ?? '',
    ).getGenerativeModel({ model: EMBEDDING_MODEL });
  }

  async retrieve(query: string, topK = 5): Promise<RetrievedChunk[]> {
    this.logger.debug(
      `Retrieving top-${topK} chunks for: "${query.slice(0, 80)}"`,
    );

    const {
      embedding: { values: queryEmbedding },
    } = await this.embeddingModel.embedContent(query);

    const results = await this.vectorStore.similaritySearch(
      queryEmbedding,
      topK,
    );

    this.logger.debug(
      `Retrieved ${results.length} chunks (top similarity: ${results[0]?.similarity.toFixed(3) ?? 'n/a'})`,
    );

    return results.map((r) => ({
      content: r.content,
      sourceFile: r.sourceFile,
      similarity: r.similarity,
    }));
  }
}
