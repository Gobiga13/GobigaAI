import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("GEMINI_API_KEY is not set in the environment.");
}

export const ai = new GoogleGenAI({ apiKey: apiKey || "" });

export const DEFAULT_MODEL = "gemini-3-flash-preview";
