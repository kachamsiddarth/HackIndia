import { BaseAgent, type AgentOutput } from "./base";
import { GitHubClient, type GitHubDiffFile } from "@/lib/github/client";

export interface GitDiffInput {
  token: string;
  owner: string;
  repo: string;
  baseCommit: string;
  headCommit: string;
}

export interface GitDiffOutput {
  baseCommit: string;
  headCommit: string;
  totalFilesChanged: number;
  uiFiles: GitHubDiffFile[];
  nonUiFilesCount: number;
  patches: Array<{
    filename: string;
    patch: string;
    status: string;
  }>;
}

export class GitDiffAgent extends BaseAgent<GitDiffInput, GitDiffOutput> {
  public readonly name = "GitDiffAgent";
  public readonly role = "Extracts git commit diffs and filters UI-relevant files for accessibility analysis";

  public async run(input: GitDiffInput): Promise<AgentOutput<GitDiffOutput>> {
    return this.executeTimed(async () => {
      const github = new GitHubClient(input.token);
      const comparison = await github.compareCommits(
        input.owner,
        input.repo,
        input.baseCommit,
        input.headCommit
      );

      const files = comparison.files || [];
      const uiExtensions = [".html", ".htm", ".jsx", ".tsx", ".js", ".ts", ".vue", ".svelte"];

      const uiFiles = files.filter((file) =>
        uiExtensions.some((ext) => file.filename.toLowerCase().endsWith(ext))
      );

      const patches = uiFiles
        .filter((file) => file.patch)
        .map((file) => ({
          filename: file.filename,
          patch: file.patch || "",
          status: file.status,
        }));

      return {
        data: {
          baseCommit: input.baseCommit,
          headCommit: input.headCommit,
          totalFilesChanged: files.length,
          uiFiles,
          nonUiFilesCount: files.length - uiFiles.length,
          patches,
        },
        confidence: 0.98,
        reasoning: `Extracted diff between ${input.baseCommit.slice(0, 7)} and ${input.headCommit.slice(0, 7)}. Found ${uiFiles.length} UI files out of ${files.length} changed files.`,
        metadata: {
          aheadBy: comparison.ahead_by,
          behindBy: comparison.behind_by,
        },
      };
    });
  }
}
