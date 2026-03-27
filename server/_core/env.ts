export const ENV = {
  isProduction: process.env.NODE_ENV === "production",
  // Optional: used for Japanese → English translation of TDnet (Metaplanet) disclosure titles.
  // Set OPENAI_API_KEY to any OpenAI-compatible key. If not set, titles are shown in Japanese.
  llmApiKey: process.env.OPENAI_API_KEY ?? "",
  llmApiUrl: process.env.OPENAI_API_BASE_URL ?? "https://api.openai.com/v1",
};
