import { GoogleGenAI } from "@google/genai";

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
if (!GOOGLE_API_KEY) {
  throw new Error("GOOGLE_API_KEY is not set in environment");
}

export const ai = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
