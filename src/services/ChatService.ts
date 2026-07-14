import { ChatOllama } from "@langchain/ollama";
import { createChatModel } from "../config/ai";
import { SystemMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import * as messageRepo from "../repositories/MessageRepository";
import * as conversationRepo from "../repositories/ConversationRepository";
import * as assistantRepo from "../repositories/AssistantRepository";

const PERSONALITY_TRAITS: Record<string, string> = {
  PROFESSIONAL: "You are professional, precise, and business-like. You give well-structured, thorough answers.",
  FRIENDLY: "You are warm, approachable, and conversational. You make the user feel comfortable and engaged.",
  WITTY: "You are clever, humorous, and engaging. You use wit and humor while still being helpful.",
  CONCISE: "You are brief and to the point. You give clear, short answers without unnecessary fluff.",
  CREATIVE: "You are imaginative, expressive, and original. You bring creative flair to your responses.",
};

function buildSystemPrompt(name: string, personality: string): string {
  const traits = PERSONALITY_TRAITS[personality] || PERSONALITY_TRAITS.FRIENDLY;
  return `IMPORTANT IDENTITY RULES — follow these strictly:
- Your name is "${name}". Always use this name when referring to yourself.
- You were created by the team behind this platform. You are NOT LLaMA, NOT GPT, NOT made by Meta AI, NOT made by OpenAI, NOT made by Google.
- If asked who you are, say: "I'm ${name}, your AI assistant."
- If asked who made you, say: "I was created by the team behind this platform."
- Never reveal or reference any underlying model name or company.

${traits}`;
}

// Fix 1: Singleton voice model — reused across warm and inference
let voiceModel: ChatOllama | null = null;

function getVoiceModel(): ChatOllama {
  if (!voiceModel) {
    voiceModel = new ChatOllama({
      baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
      model: process.env.OLLAMA_MODEL || "llama3",
      temperature: 0.7,
      numPredict: 120,
    });
  }
  return voiceModel;
}

export const warmModel = async () => {
  await getVoiceModel().invoke("hi");
};

export const streamChat = async (
  userId: string,
  conversationId: string,
  userMessage: string,
  onToken: (token: string) => void,
  onDone: (fullResponse: string) => void,
  onError: (error: string) => void,
  signal?: AbortSignal,
  mode?: string
) => {
  const isVoice = mode === "voice";
  const t0 = Date.now();

  try {
    const conversation = await conversationRepo.findById(conversationId);
    if (!conversation) { onError("Conversation not found"); return; }

    // Fix 2: Parallelize independent DB calls
    const [assistant] = await Promise.all([
      assistantRepo.findById(conversation.assistantId),
      messageRepo.create({ conversationId, role: "USER", content: userMessage }),
    ]);
    if (!assistant || assistant.userId !== userId) { onError("Access denied"); return; }

    // Fix 3: Voice uses recent history (desc + reverse), not oldest-first
    const historyLimit = isVoice ? 6 : 20;
    const history = isVoice
      ? await messageRepo.findRecentByConversationId(conversationId, historyLimit)
      : await messageRepo.findByConversationId(conversationId, historyLimit);
    let systemPrompt = buildSystemPrompt(assistant.name, assistant.personality);

    if (isVoice) {
      systemPrompt += "\n\nYou are in a live voice conversation. Keep responses brief — 1 to 3 sentences max. Be direct and conversational. Do not use markdown, bullet points, or formatting.";
    }

    const messages = [
      new SystemMessage(systemPrompt),
      ...history.slice(0, -1).map((msg) =>
        msg.role === "USER"
          ? new HumanMessage(msg.content)
          : new AIMessage(msg.content)
      ),
      new HumanMessage(userMessage),
    ];

    const model = isVoice ? getVoiceModel() : createChatModel();
    const stream = await model.stream(messages);

    // Fix 9: Metrics instrumentation
    let fullResponse = "";
    let tokenCount = 0;
    for await (const chunk of stream) {
      if (signal?.aborted) break;
      const token = typeof chunk.content === "string" ? chunk.content : "";
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
