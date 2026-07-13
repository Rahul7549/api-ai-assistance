import * as assistantRepo from "../repositories/AssistantRepository";
import { CreateAssistantDto, UpdateAssistantDto } from "../validators/assistantValidator";
import { NotFoundError, UnauthorizedError } from "../utils/errors";
import { Personality } from "@prisma/client";

const PERSONALITY_PROMPTS: Record<Personality, string> = {
  PROFESSIONAL: "You are a professional, knowledgeable assistant. Respond with clarity, precision, and a formal tone. Focus on accuracy and actionable advice.",
  FRIENDLY: "You are a warm, friendly assistant. Be conversational, supportive, and approachable. Use a casual but helpful tone.",
  WITTY: "You are a witty, clever assistant with a good sense of humor. Keep responses engaging and entertaining while still being helpful.",
  CONCISE: "You are a concise, no-nonsense assistant. Give direct, brief answers. Avoid filler words and unnecessary elaboration.",
  CREATIVE: "You are a creative, imaginative assistant. Think outside the box, offer unique perspectives, and inspire with your responses.",
};

export const create = async (userId: string, dto: CreateAssistantDto) => {
  const personality = (dto.personality as Personality) ?? "FRIENDLY";
  const systemPrompt = dto.systemPrompt || PERSONALITY_PROMPTS[personality];

  return assistantRepo.create({
    userId,
    name: dto.name,
    avatar: dto.avatar,
    personality,
    voiceId: dto.voiceId,
    systemPrompt,
  });
};

export const listByUser = async (userId: string) => {
  return assistantRepo.findByUserId(userId);
};

export const getById = async (userId: string, assistantId: string) => {
  const assistant = await assistantRepo.findById(assistantId);
  if (!assistant) throw new NotFoundError("Assistant not found");
  if (assistant.userId !== userId) throw new UnauthorizedError("Access denied");
  return assistant;
};

export const update = async (userId: string, assistantId: string, dto: UpdateAssistantDto) => {
  const assistant = await assistantRepo.findById(assistantId);
  if (!assistant) throw new NotFoundError("Assistant not found");
  if (assistant.userId !== userId) throw new UnauthorizedError("Access denied");

  const updateData: Record<string, unknown> = {};
  if (dto.name !== undefined) updateData.name = dto.name;
  if (dto.avatar !== undefined) updateData.avatar = dto.avatar;
  if (dto.voiceId !== undefined) updateData.voiceId = dto.voiceId;
  if (dto.systemPrompt !== undefined) updateData.systemPrompt = dto.systemPrompt;
  if (dto.personality !== undefined) {
    updateData.personality = dto.personality;
    if (!dto.systemPrompt) {
      updateData.systemPrompt = PERSONALITY_PROMPTS[dto.personality as Personality];
    }
  }

  return assistantRepo.update(assistantId, updateData);
};

export const remove = async (userId: string, assistantId: string) => {
  const assistant = await assistantRepo.findById(assistantId);
  if (!assistant) throw new NotFoundError("Assistant not found");
  if (assistant.userId !== userId) throw new UnauthorizedError("Access denied");
  return assistantRepo.remove(assistantId);
};
