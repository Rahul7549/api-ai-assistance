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

function getSeasonForMonth(month: number): string {
  if (month >= 3 && month <= 5) return "Spring";
  if (month >= 6 && month <= 8) return "Summer / Monsoon season (in South Asia)";
  if (month >= 9 && month <= 11) return "Autumn";
  return "Winter";
}

function getIndianFinancialYear(now: Date): string {
  const y = now.getFullYear();
  const m = now.getMonth();
  return m >= 3 ? `FY ${y}-${y + 1}` : `FY ${y - 1}-${y}`;
}

function getQuarter(month: number): string {
  if (month <= 2) return "Q1";
  if (month <= 5) return "Q2";
  if (month <= 8) return "Q3";
  return "Q4";
}

function getDayOfYear(now: Date): number {
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getDaysRemaining(now: Date): number {
  const endOfYear = new Date(now.getFullYear(), 11, 31);
  const diff = endOfYear.getTime() - now.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getWeekNumber(now: Date): number {
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function getTimeOfDay(hour: number): string {
  if (hour < 5) return "night";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 21) return "evening";
  return "night";
}

function buildSystemPrompt(name: string, personality: string): string {
  const traits = PERSONALITY_TRAITS[personality] || PERSONALITY_TRAITS.FRIENDLY;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const dayOfMonth = now.getDate();
  const hour = now.getHours();

  const fullDate = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZoneName: "short" });
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return `You are ${name}, an intelligent AI assistant.

## Current Date & Time Context
- **Today**: ${fullDate}
- **Current time**: ${timeStr} (${getTimeOfDay(hour)})
- **Year**: ${year}${isLeapYear ? " (leap year)" : ""}
- **Calendar quarter**: ${getQuarter(month)} | **Week**: ${getWeekNumber(now)} of 52
- **Day of year**: ${getDayOfYear(now)} of ${isLeapYear ? 366 : 365} | **Days remaining in year**: ${getDaysRemaining(now)}
- **Day of month**: ${dayOfMonth} of ${daysInMonth}
- **Weekend/Weekday**: ${isWeekend ? "Weekend" : "Weekday"}
- **Season**: ${getSeasonForMonth(month)}
- **Indian Financial Year**: ${getIndianFinancialYear(now)}

You ALWAYS know the current date and time. Never say "I don't have access to real-time information" or "I cannot determine the current date" when answering questions about:
- **Date & time**: current time, today's date, day of the week, month, year, what time it is
- **Relative dates**: tomorrow, yesterday, next Monday, last Friday, a week from now, 30 days ago
- **Holidays & festivals**: national holidays, religious festivals, regional celebrations, international observance days — use your knowledge combined with today's date
- **Regional events**: state-specific holidays (Karnataka Rajyotsava, Maharashtra Day, Onam, Pongal, etc.), local celebrations
- **Countdowns**: days until Christmas, New Year, Diwali, Eid, Independence Day, birthdays, deadlines
- **Age calculations**: compute age from birth year/date using today's date
- **Zodiac & astrology**: determine zodiac sign from birth date, current zodiac season, Chinese zodiac year
- **Seasons & weather context**: current season, monsoon period, summer/winter, harvest season
- **Calendar math**: working days this month, weekends remaining, days in current month, leap year status
- **Financial/fiscal**: current fiscal year, fiscal quarter, tax season, financial year-end dates
- **Academic calendar**: approximate school terms, exam seasons, vacation periods based on region
- **Historical timelines**: years since an event, how long ago something happened

For truly real-time data you cannot know (live stock prices, live sports scores, breaking news, current weather conditions, live exchange rates), acknowledge this honestly but still provide what you DO know based on the date — for example, you can say what event is scheduled even if you cannot confirm the live result.

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
  imageParts?: Array<{ inlineData: { data: string; mimeType: string } }>,
  fileAttachments?: Array<{ name: string; mimeType: string; size: number }>
) => {
  const isVoice = mode === "voice";
  const t0 = Date.now();

  try {
    const conversation = await conversationRepo.findById(conversationId);
    if (!conversation) { onError("Conversation not found"); return; }

    const [assistant] = await Promise.all([
      assistantRepo.findById(conversation.assistantId),
      messageRepo.create({ conversationId, role: "USER", content: userMessage, fileAttachments: fileAttachments || undefined }),
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
