import prisma from "../config/prisma";

export const create = (data: { assistantId: string; title?: string }) => {
  return prisma.conversation.create({ data });
};

export const findByAssistantId = (assistantId: string) => {
  return prisma.conversation.findMany({
    where: { assistantId },
    orderBy: { updatedAt: "desc" },
  });
};

export const findById = (id: string) => {
  return prisma.conversation.findUnique({ where: { id } });
};

export const updateTitle = (id: string, title: string) => {
  return prisma.conversation.update({ where: { id }, data: { title } });
};

export const remove = (id: string) => {
  return prisma.conversation.delete({ where: { id } });
};
