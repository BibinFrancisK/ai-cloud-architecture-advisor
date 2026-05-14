import { Module } from '@nestjs/common';
import { KnowledgeIngesterService } from './knowledge-ingester.service';
import { RAGRetrieverService } from './rag-retriever.service';
import { VectorStoreService } from './vector-store.service';

@Module({
  providers: [
    VectorStoreService,
    KnowledgeIngesterService,
    RAGRetrieverService,
  ],
  exports: [VectorStoreService, KnowledgeIngesterService, RAGRetrieverService],
})
export class RagModule {}
