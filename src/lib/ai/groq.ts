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
 * Active and supported Groq models ordered by capability & token budget.
 * (Decommissioned models like llama3-70b-8192 are removed).
 */
export const FALLBACK_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "mixtral-8x7b-32768",
];

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  responseFormat?: { type: "json_object" | "text" };
  /** Set to true for lightweight tasks to save 70B token quotas */
  useFastModel?: boolean;
}

/**
 * Call Groq API with system and user prompts.
 * Features:
 * 1. Automatic multi-key API rotation when a key hits rate limits.
 * 2. Skips decommissioned models automatically.
 * 3. Fast candidate fallback on 429 / TPD limit errors.
 * 4. Smart JSON response extraction & fallback parsing.
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

  let effectiveSystemPrompt = systemPrompt;

  // Groq API rule: when response_format is json_object, the word "json" MUST appear in messages
  if (responseFormat?.type === "json_object" && !/json/i.test(effectiveSystemPrompt + userPrompt)) {
    effectiveSystemPrompt += " Respond with valid JSON.";
  }

  const keys = getGroqApiKeys();

  // Model candidates sequence
  const modelCandidates = [
    model,
    ...FALLBACK_MODELS.filter((m) => m !== model),
  ];

  const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: effectiveSystemPrompt },
    { role: "user", content: userPrompt },
  ];

  let lastError: unknown;

  // Try across active key pool
  for (let keyAttempt = 0; keyAttempt < Math.max(1, keys.length * 2); keyAttempt += 1) {
    const keyIdx = (currentKeyIndex + keyAttempt) % keys.length;
    const client = getGroqClient(keyIdx);

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

        // On successful completion, save working key index
        currentKeyIndex = keyIdx;
        return content as unknown as T;
      } catch (caught: unknown) {
        lastError = caught;
        const msg = caught instanceof Error ? caught.message : String(caught);

        const isRateLimit =
          msg.includes("429") ||
          msg.includes("rate_limit") ||
          msg.includes("tokens per day") ||
          msg.includes("Limit 100000") ||
          msg.includes("TPD");

        const isDecommissioned =
          msg.includes("decommissioned") ||
          msg.includes("model_decommissioned");

        if (isDecommissioned) {
          console.warn(`[Groq AI] Model '${currentModel}' is decommissioned. Skipping model candidate...`);
          continue;
        }

        if (isRateLimit) {
          console.warn(
            `[Groq AI] Rate limit (429) hit on key ${keyIdx} with model ${currentModel}. Rotating key and model...`
          );
          currentKeyIndex = (currentKeyIndex + 1) % keys.length;
          continue;
        }

        // For other 400/500 errors, attempt fallback model candidates
        console.warn(`[Groq AI] Request error on model ${currentModel}: ${msg}`);
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("All Groq model and API key completion attempts failed.");
}
