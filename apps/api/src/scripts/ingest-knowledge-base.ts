import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { KnowledgeIngesterService } from '../rag/knowledge-ingester.service';
import { RagModule } from '../rag/rag.module';

const logger = new Logger('IngestScript');

async function run(): Promise<void> {
  if (!process.env.GEMINI_API_KEY) {
    logger.error('GEMINI_API_KEY environment variable is not set');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    logger.error('DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(RagModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    const ingester = app.get(KnowledgeIngesterService);
    const start = Date.now();
    await ingester.ingestAll();
    logger.log(`Done in ${((Date.now() - start) / 1000).toFixed(1)}s`);
  } finally {
    await app.close();
  }
}

run().catch((err: unknown) => {
  logger.error(
    `Ingestion failed: ${err instanceof Error ? err.message : String(err)}`,
  );
  process.exit(1);
});
