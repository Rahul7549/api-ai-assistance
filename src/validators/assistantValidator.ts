import { z } from "zod";

export const createAssistantSchema = z.object({
  name: z.string().min(1).max(50),
  avatar: z.string().optional(),
  personality: z.enum(["PROFESSIONAL", "FRIENDLY", "WITTY", "CONCISE", "CREATIVE"]).optional(),
  voiceId: z.string().optional(),
  systemPrompt: z.string().max(2000).optional(),
});

export const updateAssistantSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  avatar: z.string().optional(),
  personality: z.enum(["PROFESSIONAL", "FRIENDLY", "WITTY", "CONCISE", "CREATIVE"]).optional(),
  voiceId: z.string().optional(),
  systemPrompt: z.string().max(2000).optional(),
});

export type CreateAssistantDto = z.infer<typeof createAssistantSchema>;
export type UpdateAssistantDto = z.infer<typeof updateAssistantSchema>;
