import Groq from "groq-sdk";

export const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || "",
});

export const DEFAULT_MODEL = "llama-3.3-70b-versatile";

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

  const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  const completion = await groq.chat.completions.create({
    messages,
    model,
    temperature,
    max_tokens: maxTokens,
    ...(responseFormat ? { response_format: responseFormat } : {}),
  });

  const content = completion.choices[0]?.message?.content || "";

  if (responseFormat?.type === "json_object") {
    try {
      return JSON.parse(content) as T;
    } catch {
      throw new Error(`Failed to parse JSON response from Groq: ${content}`);
    }
  }

  return content as unknown as T;
}
