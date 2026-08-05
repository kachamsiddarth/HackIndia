import Groq from "groq-sdk";

/**
 * Extract API keys from GROQ_API_KEY environment variable.
 * Supports a single key or comma-separated list of keys for automatic key rotation.
 */
function getGroqApiKeys(): string[] {
  const rawKey = process.env.GROQ_API_KEY || "";
  const keys = rawKey
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  return keys.length > 0 ? keys : [""];
}

let currentKeyIndex = 0;

/**
 * Returns a Groq SDK instance using the current active API key in the pool.
 */
function getGroqClient(keyIndex?: number): Groq {
  const keys = getGroqApiKeys();
  const index = keyIndex ?? currentKeyIndex;
  const apiKey = keys[index % keys.length] || "";
  return new Groq({ apiKey });
}

export const DEFAULT_MODEL = "llama-3.3-70b-versatile";
export const FAST_MODEL = "llama-3.1-8b-instant";

/**
 * Fallback models ordered by quality and token availability.
 */
export const FALLBACK_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "llama3-70b-8192",
  "mixtral-8x7b-32768",
];

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  responseFormat?: { type: "json_object" | "text" };
  /** Set to true for lightweight tasks (architecture summary, diagnosis) to save 70B tokens */
  useFastModel?: boolean;
}

/**
 * Call Groq API with system and user prompts.
 * Features:
 * 1. Automatic multi-key API rotation when a key hits rate limits.
 * 2. Automatic model fallback (70b -> 8b instant -> 70b-8192 -> mixtral) on rate limit / 429 errors.
 * 3. Smart JSON response extraction & fallback parsing.
 */
export async function generateCompletion<T = string>(
  userPrompt: string,
  options: ChatOptions = {}
): Promise<T> {
  const {
    model = options.useFastModel ? FAST_MODEL : DEFAULT_MODEL,
    temperature = 0.2,
    maxTokens = 4096,
    systemPrompt = "You are AccessDiff AI, an expert accessibility engineer following WCAG 2.2 AA standards.",
    responseFormat,
  } = options;

  const keys = getGroqApiKeys();

  // Model candidates sequence
  const modelCandidates = [
    model,
    ...FALLBACK_MODELS.filter((m) => m !== model),
  ];

  const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  let lastError: unknown;

  // Try each API key in pool
  for (let keyAttempt = 0; keyAttempt < keys.length; keyAttempt += 1) {
    const keyIdx = (currentKeyIndex + keyAttempt) % keys.length;
    const client = getGroqClient(keyIdx);

    // Try model candidates
    for (const currentModel of modelCandidates) {
      try {
        const completion = await client.chat.completions.create({
          messages,
          model: currentModel,
          temperature,
          max_tokens: maxTokens,
          ...(responseFormat ? { response_format: responseFormat } : {}),
        });

        const content = completion.choices[0]?.message?.content || "";

        if (responseFormat?.type === "json_object") {
          try {
            return JSON.parse(content) as T;
          } catch {
            const jsonMatch = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
            if (jsonMatch) {
              return JSON.parse(jsonMatch[0]) as T;
            }
            throw new Error(`Failed to parse JSON response from Groq (${currentModel}): ${content}`);
          }
        }

        return content as unknown as T;
      } catch (caught: unknown) {
        lastError = caught;
        const isRateLimit =
          caught instanceof Error &&
          (caught.message.includes("429") ||
            caught.message.includes("rate_limit") ||
            caught.message.includes("tokens per day") ||
            caught.message.includes("Limit 100000"));

        if (isRateLimit) {
          console.warn(
            `[Groq AI] Rate limit on model '${currentModel}' (Key index ${keyIdx}). Trying fallback...`
          );
          continue; // Try next fallback model
        }

        throw caught;
      }
    }

    // If all models failed on this key due to rate limits, rotate active key index
    if (keys.length > 1) {
      currentKeyIndex = (currentKeyIndex + 1) % keys.length;
      console.warn(`[Groq AI] Rotated active API key to key #${currentKeyIndex + 1}`);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("All Groq model and API key completion attempts failed.");
}
