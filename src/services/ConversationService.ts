import * as conversationRepo from "../repositories/ConversationRepository";
import * as messageRepo from "../repositories/MessageRepository";
import * as assistantRepo from "../repositories/AssistantRepository";
import { NotFoundError, UnauthorizedError } from "../utils/errors";

export const create = async (userId: string, assistantId: string, title?: string) => {
  const assistant = await assistantRepo.findById(assistantId);
  if (!assistant) throw new NotFoundError("Assistant not found");
  if (assistant.userId !== userId) throw new UnauthorizedError("Access denied");

  return conversationRepo.create({ assistantId, title });
};

export const listByAssistant = async (userId: string, assistantId: string) => {
  const assistant = await assistantRepo.findById(assistantId);
  if (!assistant) throw new NotFoundError("Assistant not found");
  if (assistant.userId !== userId) throw new UnauthorizedError("Access denied");

  return conversationRepo.findByAssistantId(assistantId);
};

export const getMessages = async (userId: string, conversationId: string) => {
  const conversation = await conversationRepo.findById(conversationId);
  if (!conversation) throw new NotFoundError("Conversation not found");

  const assistant = await assistantRepo.findById(conversation.assistantId);
  if (!assistant || assistant.userId !== userId) throw new UnauthorizedError("Access denied");

  return messageRepo.findByConversationId(conversationId);
};

export const addMessage = async (
  userId: string,
  conversationId: string,
  role: "USER" | "ASSISTANT",
  content: string
) => {
  const conversation = await conversationRepo.findById(conversationId);
  if (!conversation) throw new NotFoundError("Conversation not found");

  const assistant = await assistantRepo.findById(conversation.assistantId);
  if (!assistant || assistant.userId !== userId) throw new UnauthorizedError("Access denied");

  return messageRepo.create({ conversationId, role, content });
};

export const remove = async (userId: string, conversationId: string) => {
  const conversation = await conversationRepo.findById(conversationId);
  if (!conversation) throw new NotFoundError("Conversation not found");

  const assistant = await assistantRepo.findById(conversation.assistantId);
  if (!assistant || assistant.userId !== userId) throw new UnauthorizedError("Access denied");

  return conversationRepo.remove(conversationId);
};
