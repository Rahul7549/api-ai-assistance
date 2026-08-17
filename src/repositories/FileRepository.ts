import prisma from "../config/prisma";

export const create = (data: {
  userId: string;
  conversationId?: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  extractedText?: string;
}) => {
  return prisma.file.create({ data });
};

export const findById = (id: string) => {
  return prisma.file.findUnique({ where: { id } });
};

export const findByConversationId = (conversationId: string) => {
  return prisma.file.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
  });
};

export const findByIdWithChunks = (id: string) => {
  return prisma.file.findUnique({
    where: { id },
    include: { chunks: { orderBy: { chunkIndex: "asc" } } },
  });
};

export async function updateConversationId(fileId: string, conversationId: string) {
  return prisma.file.update({
    where: { id: fileId },
    data: { conversationId },
  });
}
