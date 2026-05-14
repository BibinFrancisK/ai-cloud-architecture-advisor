import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { VectorStoreService } from './vector-store.service';
import { EMBEDDING_MODEL } from './rag.constants';

const CHUNK_DELAY_MS = 800;

@Injectable()
export class KnowledgeIngesterService {
  private readonly logger = new Logger(KnowledgeIngesterService.name);

  private readonly splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  constructor(private readonly vectorStore: VectorStoreService) {}

  async ingestAll(): Promise<void> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY environment variable is required for ingestion',
      );
    }

    const embeddingModel = new GoogleGenerativeAI(apiKey).getGenerativeModel({
      model: EMBEDDING_MODEL,
    });

    // Default path works when npm run ingest is executed from apps/api/.
    // Override with KNOWLEDGE_BASE_PATH env var when running inside Docker.
    const knowledgeBasePath =
      process.env.KNOWLEDGE_BASE_PATH ??
      path.resolve(process.cwd(), '../../knowledge-base');

    const files = fs
      .readdirSync(knowledgeBasePath)
      .filter((f) => f.endsWith('.md'));
    this.logger.log(`Found ${files.length} files in ${knowledgeBasePath}`);

    await this.vectorStore.clearAll();

    let totalChunks = 0;

    for (const file of files) {
      const content = fs.readFileSync(
        path.join(knowledgeBasePath, file),
        'utf-8',
      );
      const chunks = await this.splitter.splitText(content);
      this.logger.log(`${file}: ${chunks.length} chunks`);

      const start = Date.now();

      for (let i = 0; i < chunks.length; i++) {
        // Batch embed suppresses errors. So, embed one chunk at a time.
        const {
          embedding: { values: embedding },
        } = await embeddingModel.embedContent(chunks[i]);

        await this.vectorStore.upsertChunk({
          content: chunks[i],
          sourceFile: file,
          chunkIndex: i,
          metadata: { source: file },
          embedding,
        });

        if (i < chunks.length - 1) {
          await new Promise<void>((resolve) =>
            setTimeout(resolve, CHUNK_DELAY_MS),
          );
        }
      }

      this.logger.log(`${file}: stored in ${Date.now() - start}ms`);
      totalChunks += chunks.length;
    }

    this.logger.log(
      `Ingestion complete — ${totalChunks} chunks from ${files.length} files`,
    );
  }
}
