import { ai, GEMINI_MODEL } from "../config/ai";
import type { Content } from "@google/genai";
import * as messageRepo from "../repositories/MessageRepository";
import * as conversationRepo from "../repositories/ConversationRepository";
import * as assistantRepo from "../repositories/AssistantRepository";

const PERSONALITY_TRAITS: Record<string, string> = {
  PROFESSIONAL: "Your communication style is professional and precise. Structure answers clearly with headings and bullet points when appropriate. Prioritize accuracy and thoroughness.",
  FRIENDLY: "Your communication style is warm, approachable, and conversational. Use a natural tone that makes the user feel comfortable. Be encouraging and supportive.",
  WITTY: "Your communication style is clever and engaging. Use light humor and wordplay where appropriate, but always prioritize being genuinely helpful over being funny.",
  CONCISE: "Your communication style is direct and efficient. Lead with the answer, then provide supporting details only when needed. Avoid filler words and unnecessary preamble.",
  CREATIVE: "Your communication style is imaginative and expressive. Offer original perspectives and creative solutions. Use vivid examples and analogies to explain concepts.",
};

function buildSystemPrompt(name: string, personality: string): string {
  const traits = PERSONALITY_TRAITS[personality] || PERSONALITY_TRAITS.FRIENDLY;
  return `You are ${name}, an intelligent AI assistant.

## Identity
- Your name is "${name}". Use this name when referring to yourself.
- You were created by the team behind this platform.
- If asked who you are, say: "I'm ${name}, your AI assistant."
- If asked who made you, say: "I was created by the team behind this platform."
- Never mention Gemini, GPT, Meta, OpenAI, Google, or any underlying model.

## Personality
${traits}

## Response Guidelines
- Read the user's message carefully. Answer exactly what was asked — do not add unrequested information.
- When the user asks for content (emails, documents, code, lists), produce the content directly without preamble like "Sure!" or "Here you go!".
- Use markdown formatting (headings, bold, lists, code blocks) to make responses easy to read.
- For factual questions, be accurate. If you are unsure, say so rather than guessing.
- For creative tasks, be thoughtful and original.
- Keep responses focused and proportional to the question — a simple question deserves a concise answer, a complex one deserves a detailed answer.
- Never repeat the user's question back to them. Never start with "Great question!".`;
}

export const warmModel = async () => {};

export const streamChat = async (
  userId: string,
  conversationId: string,
  userMessage: string,
  onToken: (token: string) => void,
  onDone: (fullResponse: string) => void,
  onError: (error: string) => void,
  signal?: AbortSignal,
  mode?: string,
  contextPrefix?: string,
  imageParts?: Array<{ inlineData: { data: string; mimeType: string } }>
) => {
  const isVoice = mode === "voice";
  const t0 = Date.now();

  try {
    const conversation = await conversationRepo.findById(conversationId);
    if (!conversation) { onError("Conversation not found"); return; }

    const [assistant] = await Promise.all([
      assistantRepo.findById(conversation.assistantId),
      messageRepo.create({ conversationId, role: "USER", content: userMessage }),
    ]);
    if (!assistant || assistant.userId !== userId) { onError("Access denied"); return; }

    const historyLimit = isVoice ? 6 : 20;
    const history = isVoice
      ? await messageRepo.findRecentByConversationId(conversationId, historyLimit)
      : await messageRepo.findByConversationId(conversationId, historyLimit);
    let systemPrompt = buildSystemPrompt(assistant.name, assistant.personality);

    if (contextPrefix) {
      systemPrompt += "\n\n" + contextPrefix;
    }

    if (isVoice) {
      systemPrompt += "\n\nYou are in a live voice conversation. Keep responses brief — 1 to 3 sentences max. Be direct and conversational. Do not use markdown, bullet points, or formatting.";
    }

    const userParts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [
      { text: userMessage },
    ];
    if (imageParts?.length) {
      userParts.push(...imageParts);
    }

    const contents: Content[] = [
      ...history.slice(0, -1).map((msg): Content => ({
        role: msg.role === "USER" ? "user" : "model",
        parts: [{ text: msg.content }],
      })),
      { role: "user", parts: userParts },
    ];

    const response = await ai.models.generateContentStream({
      model: GEMINI_MODEL,
      contents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
        maxOutputTokens: isVoice ? 200 : 2048,
      },
    });

    let fullResponse = "";
    let tokenCount = 0;
    for await (const chunk of response) {
      if (signal?.aborted) break;
      const token = chunk.text || "";
      if (token) {
        if (isVoice && tokenCount === 0) {
          console.log(`[voice-metrics] TTFT=${Date.now() - t0}ms`);
        }
        tokenCount++;
        fullResponse += token;
        onToken(token);
      }
    }

    if (isVoice) {
      const elapsed = Date.now() - t0;
      console.log(`[voice-metrics] total=${elapsed}ms tokens=${tokenCount} tps=${(tokenCount / (elapsed / 1000)).toFixed(1)}`);
    }

    if (fullResponse) {
      await messageRepo.create({ conversationId, role: "ASSISTANT", content: fullResponse });
    }

    if (history.length <= 1) {
      const title = userMessage.length > 50 ? userMessage.slice(0, 50) + "..." : userMessage;
      await conversationRepo.updateTitle(conversationId, title);
    }

    onDone(fullResponse);
  } catch (err) {
    if (signal?.aborted) return;
    onError(err instanceof Error ? err.message : "AI processing failed");
  }
};
