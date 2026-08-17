import { ai } from "../config/ai";
import * as fileRepo from "../repositories/FileRepository";
import * as chunkRepo from "../repositories/DocumentChunkRepository";

const EMBEDDING_MODEL = "gemini-embedding-001";
// Must match the DocumentChunk.embedding column dimension (vector(768)).
const EMBEDDING_DIMENSIONS = 768;
const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;
const EMBED_BATCH_SIZE = 100;

function chunkText(text: string): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current: string[] = [];
  let currentLen = 0;

  for (const sentence of sentences) {
    const words = sentence.split(/\s+/).length;
    if (currentLen + words > CHUNK_SIZE && current.length > 0) {
      chunks.push(current.join(" "));
      const overlapSentences: string[] = [];
      let overlapLen = 0;
      for (let i = current.length - 1; i >= 0; i--) {
        const sWords = current[i].split(/\s+/).length;
        if (overlapLen + sWords > CHUNK_OVERLAP) break;
        overlapSentences.unshift(current[i]);
        overlapLen += sWords;
      }
      current = overlapSentences;
      currentLen = overlapLen;
    }
    current.push(sentence);
    currentLen += words;
  }

  if (current.length > 0) {
    chunks.push(current.join(" "));
  }

  return chunks;
}

async function embedText(text: string): Promise<number[]> {
  const result = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
    config: { outputDimensionality: EMBEDDING_DIMENSIONS },
  });
  return result.embeddings?.[0]?.values ?? [];
}

async function embedTexts(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBED_BATCH_SIZE);
    const result = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: batch,
      config: { outputDimensionality: EMBEDDING_DIMENSIONS },
    });
    for (const embedding of result.embeddings ?? []) {
      embeddings.push(embedding.values ?? []);
    }
  }

  return embeddings;
}

export async function indexDocument(fileId: string): Promise<void> {
  const file = await fileRepo.findByIdWithChunks(fileId);
  if (!file?.extractedText) return;

  if (file.chunks.length > 0) {
    await chunkRepo.deleteByFileId(fileId);
  }

  const textChunks = chunkText(file.extractedText);
  if (textChunks.length === 0) return;

  const embeddings = await embedTexts(textChunks);

  const chunks = textChunks
    .map((content, index) => ({
      fileId,
      content,
      chunkIndex: index,
      embedding: embeddings[index],
    }))
    .filter((chunk) => chunk.embedding.length === EMBEDDING_DIMENSIONS);

  if (chunks.length === 0) return;

  await chunkRepo.createMany(chunks);
  console.log(`[RagService] Indexed ${chunks.length} chunks for file ${file.originalName}`);
}

export async function retrieveContext(
  conversationId: string,
  query: string
): Promise<{ contextPrefix: string; sourceFiles: string[] } | null> {
  const hasChunks = await chunkRepo.hasChunksForConversation(conversationId);
  if (!hasChunks) return null;

  const queryEmbedding = await embedText(query);
  if (queryEmbedding.length !== EMBEDDING_DIMENSIONS) return null;

  const results = await chunkRepo.vectorSearch(conversationId, queryEmbedding, 5);
  if (results.length === 0) return null;

  const fileIds = [...new Set(results.map((r) => r.fileId))];
  const files = await Promise.all(fileIds.map((id) => fileRepo.findById(id)));
  const sourceFiles = files
    .filter((f): f is NonNullable<typeof f> => f !== null)
    .map((f) => f.originalName);

  const contextPrefix = `## Relevant Context (from uploaded documents)\n\n${results
    .map((r, i) => `[Chunk ${i + 1}]\n${r.content}`)
    .join("\n\n---\n\n")}\n\nUse the context above to answer the user's question. Cite the document when relevant.`;

  return { contextPrefix, sourceFiles };
}

export async function deleteDocumentChunks(fileId: string): Promise<void> {
  await chunkRepo.deleteByFileId(fileId);
}
