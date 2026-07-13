import prisma from "../config/prisma";
import { MessageRole } from "@prisma/client";

export const create = (data: {
  conversationId: string;
  role: MessageRole;
  content: string;
}) => {
  return prisma.message.create({ data });
};

export const findById = (id: string) => {
  return prisma.message.findUnique({ where: { id } });
};

export const findByConversationId = (conversationId: string, limit = 50, offset = 0) => {
  return prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: limit,
    skip: offset,
  });
};

export const update = (id: string, content: string) => {
  return prisma.message.update({ where: { id }, data: { content } });
};

export const remove = (id: string) => {
  return prisma.message.delete({ where: { id } });
};

export const deleteAfter = async (conversationId: string, messageId: string) => {
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message) return;
  await prisma.message.deleteMany({
    where: {
      conversationId,
      createdAt: { gt: message.createdAt },
    },
  });
};
