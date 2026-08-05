import { BaseAgent, type AgentOutput } from "./base";
import { generateCompletion } from "@/lib/ai/groq";

export interface RiskArea {
  component: string;
  filePath: string;
  riskLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  reason: string;
}

export interface RepositorySummary {
  framework: string;
  language: string;
  componentCount: number;
  riskAreas: RiskArea[];
  aiSummary: string;
  accessibilityScoreEstimate: number;
}

export interface RepositoryAgentInput {
  repoName: string;
  filePaths: string[];
  packageJsonContent?: string;
}

export class RepositoryAgent extends BaseAgent<RepositoryAgentInput, RepositorySummary> {
  public readonly name = "RepositoryAgent";
  public readonly role = "Identifies repository architecture and accessibility risk areas";

  public async run(input: RepositoryAgentInput): Promise<AgentOutput<RepositorySummary>> {
    return this.executeTimed(async () => {
      const data = await this.analyzeRepository(
        input.repoName,
        input.filePaths,
        input.packageJsonContent
      );

      return {
        data,
        confidence: 90,
        reasoning: `Analyzed ${input.filePaths.length} repository paths and identified ${data.riskAreas.length} accessibility risk areas.`,
      };
    });
  }

  /**
   * Analyze file tree and package manifest to identify technology stack and high-risk accessibility areas.
   */
  async analyzeRepository(
    repoName: string,
    filePaths: string[],
    packageJsonContent?: string
  ): Promise<RepositorySummary> {
    const prompt = `
You are the RepositoryAgent of AccessDiff, an AI accessibility engineering platform.
Analyze the following repository structure and provide a detailed risk assessment.

Repository Name: ${repoName}

File List (Sample of repo paths):
${filePaths.slice(0, 100).join("\n")}

${packageJsonContent ? `Package.json Content:\n${packageJsonContent.slice(0, 1000)}` : ""}

Return a JSON object matching this exact schema:
{
  "framework": "detected framework e.g. Next.js, React, Vue, Vanilla HTML",
  "language": "TypeScript | JavaScript | HTML",
  "componentCount": number of UI components detected,
  "riskAreas": [
    {
      "component": "Component name e.g. NavigationMenu / Modal / ContactForm",
      "filePath": "relative path to file",
      "riskLevel": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
      "reason": "Why this element is an accessibility risk (e.g. lacks ARIA roles, unlabelled inputs)"
    }
  ],
  "aiSummary": "2-3 sentence overview of the repository's frontend architecture and key accessibility considerations.",
  "accessibilityScoreEstimate": estimated initial score 0-100
}
`;

    return generateCompletion<RepositorySummary>(prompt, {
      systemPrompt: "You are an expert AI repository analysis agent specializing in WCAG accessibility risk audits.",
      responseFormat: { type: "json_object" },
      temperature: 0.2,
      useFastModel: true,
    });
  }
}
