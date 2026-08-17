import prisma from "../config/prisma";

export const createMany = async (
  chunks: Array<{
    fileId: string;
    content: string;
    chunkIndex: number;
    embedding: number[];
  }>
): Promise<void> => {
  for (const chunk of chunks) {
    await prisma.$executeRaw`
      INSERT INTO "DocumentChunk" ("id", "fileId", "content", "chunkIndex", "createdAt", "embedding")
      VALUES (
        gen_random_uuid(),
        ${chunk.fileId},
        ${chunk.content},
        ${chunk.chunkIndex},
        NOW(),
        ${chunk.embedding}::vector
      )
    `;
  }
};

export const deleteByFileId = async (fileId: string): Promise<void> => {
  await prisma.documentChunk.deleteMany({ where: { fileId } });
};

export const vectorSearch = async (
  conversationId: string,
  queryEmbedding: number[],
  limit = 5
): Promise<Array<{ content: string; fileId: string }>> => {
  return prisma.$queryRaw<Array<{ content: string; fileId: string }>>`
    SELECT dc."content", dc."fileId"
    FROM "DocumentChunk" dc
    JOIN "File" f ON f."id" = dc."fileId"
    WHERE f."conversationId" = ${conversationId}
    ORDER BY dc."embedding" <=> ${queryEmbedding}::vector
    LIMIT ${limit}
  `;
};

export const hasChunksForConversation = async (conversationId: string): Promise<boolean> => {
  const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count
    FROM "DocumentChunk" dc
    JOIN "File" f ON f."id" = dc."fileId"
    WHERE f."conversationId" = ${conversationId}
  `;
  return Number(result[0]?.count ?? 0) > 0;
};
