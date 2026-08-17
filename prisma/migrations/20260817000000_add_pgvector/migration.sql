-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to DocumentChunk
ALTER TABLE "DocumentChunk" ADD COLUMN "embedding" vector(768);

-- Create HNSW index for fast similarity search
CREATE INDEX "DocumentChunk_embedding_idx" ON "DocumentChunk" USING hnsw ("embedding" vector_cosine_ops);
