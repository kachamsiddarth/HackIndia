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

  // Try across active key pool
  for (let keyAttempt = 0; keyAttempt < keys.length; keyAttempt += 1) {
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

        // On successful completion, advance active key index to balance key load across calls
        if (keyAttempt > 0) {
          currentKeyIndex = keyIdx;
        }

        return content as unknown as T;
      } catch (caught: unknown) {
        lastError = caught;
        const msg = caught instanceof Error ? caught.message : String(caught);

        const isRateLimit =
          msg.includes("429") ||
          msg.includes("rate_limit") ||
          msg.includes("tokens per day") ||
          msg.includes("Limit 100000");

        const isDecommissionedOrNotFound =
          msg.includes("decommissioned") ||
          msg.includes("model_decommissioned") ||
          msg.includes("not_found") ||
          msg.includes("400");

        if (isDecommissionedOrNotFound) {
          console.warn(`[Groq AI] Model '${currentModel}' is decommissioned or unavailable. Skipping...`);
          continue; // Skip decommissioned models immediately
        }

        if (isRateLimit) {
          console.warn(
            `[Groq AI] Rate limit on model '${currentModel}' (Key index ${keyIdx}). Trying candidate...`
          );
          continue; // Try next fallback model on this key
        }

        throw caught;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("All Groq model and API key completion attempts failed.");
}
