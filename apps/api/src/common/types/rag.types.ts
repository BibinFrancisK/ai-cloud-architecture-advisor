export interface KnowledgeChunkInput {
  content: string;
  sourceFile: string;
  chunkIndex: number;
  metadata?: Record<string, unknown>;
  embedding: number[];
}

export interface SearchResult {
  id: string;
  content: string;
  sourceFile: string;
  chunkIndex: number;
  metadata: Record<string, unknown> | null;
  similarity: number;
}

export interface RetrievedChunk {
  content: string;
  sourceFile: string;
  similarity: number;
}
