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

export const streamChat = async (
  userId: string,
  conversationId: string,
  userMessage: string,
  onToken: (token: string) => void,
  onDone: (fullResponse: string) => void,
  onError: (error: string) => void,
  signal?: AbortSignal
) => {
  try {
    const conversation = await conversationRepo.findById(conversationId);
    if (!conversation) { onError("Conversation not found"); return; }

    const assistant = await assistantRepo.findById(conversation.assistantId);
    if (!assistant || assistant.userId !== userId) { onError("Access denied"); return; }

    // Save user message
    await messageRepo.create({ conversationId, role: "USER", content: userMessage });

    // Build message history
    const history = await messageRepo.findByConversationId(conversationId, 20);
    const systemPrompt = buildSystemPrompt(assistant.name, assistant.personality);

    const messages = [
      new SystemMessage(systemPrompt),
      ...history.slice(0, -1).map((msg) =>
        msg.role === "USER"
          ? new HumanMessage(msg.content)
          : new AIMessage(msg.content)
      ),
      new HumanMessage(userMessage),
    ];

    // Stream from Ollama via LangChain
    const model = createChatModel();
    const stream = await model.stream(messages);

    let fullResponse = "";
    for await (const chunk of stream) {
      if (signal?.aborted) break;
      const token = typeof chunk.content === "string" ? chunk.content : "";
      if (token) {
        fullResponse += token;
        onToken(token);
      }
    }

    // Save assistant response (even partial if cancelled)
    if (fullResponse) {
      await messageRepo.create({ conversationId, role: "ASSISTANT", content: fullResponse });
    }

    // Update conversation title from first user message
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
