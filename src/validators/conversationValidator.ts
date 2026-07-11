import { z } from "zod";

export const createConversationSchema = z.object({
  assistantId: z.string().uuid(),
  title: z.string().min(1).max(100).optional(),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(10000),
});

export type CreateConversationDto = z.infer<typeof createConversationSchema>;
export type SendMessageDto = z.infer<typeof sendMessageSchema>;
