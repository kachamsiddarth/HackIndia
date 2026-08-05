import { BaseAgent, type AgentOutput } from "./base";
import { generateCompletion } from "@/lib/ai/groq";

export interface AssistantInput {
  userMessage: string;
  projectContext?: string;
  chatHistory?: { role: "user" | "assistant"; content: string }[];
}

export interface AssistantOutput {
  reply: string;
  suggestedActions?: string[];
}

export class SarvamAssistantAgent extends BaseAgent<AssistantInput, AssistantOutput> {
  public readonly name = "SarvamAssistantAgent";
  public readonly role = "Multilingual accessibility assistant powered by Sarvam AI and Groq";

  public async run(input: AssistantInput): Promise<AgentOutput<AssistantOutput>> {
    return this.executeTimed(async () => {
      const historyStr = (input.chatHistory ?? [])
        .slice(-6)
        .map((m) => `${m.role}: ${m.content}`)
        .join("\n");

      const prompt = `${input.projectContext ? `Project Context:\n${input.projectContext}\n\n` : ""}${historyStr ? `Chat History:\n${historyStr}\n\n` : ""}User: ${input.userMessage}

Provide a helpful, concise response. If the question is about accessibility, include WCAG rule references and code examples. If suggesting actions, list them clearly.

Return JSON: { "reply": "your response", "suggestedActions": ["optional action 1", "action 2"] }`;

      const result = await generateCompletion<AssistantOutput>(prompt, {
        systemPrompt:
          "You are the AccessDiff AI Assistant. You help developers understand and fix web accessibility issues following WCAG 2.2 AA standards. You can explain violations, suggest code fixes, and guide remediation. Respond with valid JSON.",
        responseFormat: { type: "json_object" },
        temperature: 0.3,
        maxTokens: 2048,
        useFastModel: true,
      });

      return {
        data: {
          reply: result.reply || "I'm sorry, I couldn't generate a response. Please try again.",
          suggestedActions: result.suggestedActions,
        },
        confidence: 0.9,
        reasoning: "Generated accessibility assistant response.",
      };
    });
  }
}
