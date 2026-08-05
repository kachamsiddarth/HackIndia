import { BaseAgent, type AgentOutput } from "./base";
import { GitHubClient } from "@/lib/github/client";
import type { GeneratedFix } from "./accessibility-fix-agent";

export interface PullRequestInput {
  token: string;
  owner: string;
  repo: string;
  baseBranch: string;
  headBranch: string;
  fixes: GeneratedFix[];
  verificationSummary: string;
}

export interface PullRequestOutput {
  number: number;
  url: string;
  title: string;
}

export class PullRequestAgent extends BaseAgent<PullRequestInput, PullRequestOutput> {
  public readonly name = "PullRequestAgent";
  public readonly role = "Creates a GitHub pull request containing approved, verified accessibility fixes";

  public async run(input: PullRequestInput): Promise<AgentOutput<PullRequestOutput>> {
    return this.executeTimed(async () => {
      if (input.fixes.length === 0) {
        throw new Error("A pull request requires at least one approved fix.");
      }

      const title = `fix(a11y): resolve ${input.fixes.length} accessibility issue${input.fixes.length === 1 ? "" : "s"}`;
      const body = [
        "## AccessDiff accessibility fixes",
        "",
        input.verificationSummary,
        "",
        "### Fixed files",
        ...input.fixes.map((fix) => `- \`${fix.filePath}\` — ${fix.explanation}`),
      ].join("\n");
      const result = await new GitHubClient(input.token).createPullRequest(input.owner, input.repo, {
        title,
        body,
        head: input.headBranch,
        base: input.baseBranch,
      });

      return {
        data: { number: result.number, url: result.html_url, title: result.title },
        confidence: 100,
        reasoning: `Created pull request #${result.number} with ${input.fixes.length} verified accessibility fixes.`,
      };
    });
  }
}
