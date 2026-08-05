import Groq from "groq-sdk";

export const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || "",
});

export const DEFAULT_MODEL = "llama-3.3-70b-versatile";

/**
 * Fallback models ordered by quality and token availability.
 * If the primary model hits a Groq rate limit (429 / TPD limit), the system automatically
 * falls back down the list (e.g. to llama-3.1-8b-instant which has a much higher daily token limit).
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
}

/**
 * Call Groq API with system and user prompts.
 * Automatically handles JSON parsing when responseFormat is set to json_object.
 * Includes automatic rate-limit (429) fallback across secondary Groq models.
 */
export async function generateCompletion<T = string>(
  userPrompt: string,
  options: ChatOptions = {}
): Promise<T> {
  const {
    model = DEFAULT_MODEL,
    temperature = 0.2,
    maxTokens = 4096,
    systemPrompt = "You are AccessDiff AI, an expert accessibility engineer following WCAG 2.2 AA standards.",
    responseFormat,
  } = options;

  // Build model candidate sequence starting with requested model
  const modelCandidates = [
    model,
    ...FALLBACK_MODELS.filter((m) => m !== model),
  ];

  const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  let lastError: unknown;

  for (const currentModel of modelCandidates) {
    try {
      const completion = await groq.chat.completions.create({
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
          // If strict JSON parsing failed on output, try fallback clean-up
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
          `[Groq AI] Rate limit reached on model '${currentModel}'. Falling back to next candidate...`
        );
        // Continue to next fallback model candidate
        continue;
      }

      // If it's not a rate limit error, throw immediately
      throw caught;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("All Groq model completion attempts failed.");
}
