export const UPSERT_CHUNK = `
  INSERT INTO knowledge_chunks (content, source_file, chunk_index, metadata, embedding)
  VALUES ($1, $2, $3, $4, $5::vector)
`;

export const SIMILARITY_SEARCH = `
  SELECT id, content, source_file, chunk_index, metadata,
         1 - (embedding <=> $1::vector) AS similarity
  FROM knowledge_chunks
  ORDER BY embedding <=> $1::vector
  LIMIT $2
`;

export const CLEAR_ALL = `DELETE FROM knowledge_chunks`;

export const GET_CHUNK_COUNT = `SELECT COUNT(*) AS count FROM knowledge_chunks`;
