import prisma from "../config/prisma";
import { Personality } from "@prisma/client";

export const create = (data: {
  userId: string;
  name: string;
  avatar?: string;
  personality?: Personality;
  voiceId?: string;
  systemPrompt?: string;
}) => {
  return prisma.assistant.create({ data });
};

export const findByUserId = (userId: string) => {
  return prisma.assistant.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
};

export const findById = (id: string) => {
  return prisma.assistant.findUnique({ where: { id } });
};

export const update = (id: string, data: Partial<{
  name: string;
  avatar: string;
  personality: Personality;
  voiceId: string;
  systemPrompt: string;
}>) => {
  return prisma.assistant.update({ where: { id }, data });
};

export const remove = (id: string) => {
  return prisma.assistant.delete({ where: { id } });
};
