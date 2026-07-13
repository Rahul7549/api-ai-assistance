import prisma from "../config/prisma";
import { MessageRole } from "@prisma/client";

export const create = (data: {
  conversationId: string;
  role: MessageRole;
  content: string;
}) => {
  return prisma.message.create({ data });
};

export const findByConversationId = (conversationId: string, limit = 50, offset = 0) => {
  return prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: limit,
    skip: offset,
  });
};
