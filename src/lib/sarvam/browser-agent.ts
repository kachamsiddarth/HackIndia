import { generateCompletion } from "@/lib/ai/groq";
import type { AgentPlan, AgentToolType, ActionContext } from "./agent-types";
import { ActionRegistry } from "./action-registry";

const AGENT_SYSTEM_PROMPT = `
You are the Sarvam AI Browser Agent operating as an autonomous Product Operator for the AccessDiff platform.
Your objective is to translate natural language user requests into actionable tool executions using existing platform APIs and agents.

Available Tools:
- "ImportRepositoryTool": Params { repoName: "owner/repo" }. Use when user asks to import a GitHub repository.
- "RunPipelineTool": Params { projectId?: "id", baseCommit?: "sha", headCommit?: "sha" }. Use when user asks to run accessibility audit/pipeline.
- "CreatePRTool": Params { projectId?: "id", pipelineRunId?: "id", directCommit?: boolean }. Use when user asks to create a pull request or commit fixes.
- "ExplainViolationTool": Params { violationId: "id" }. Use when user asks to explain a specific accessibility issue.
- "OptimizeFixesTool": Params { pipelineRunId?: "id" }. Use when user asks to optimize failed fixes.
- "OpenGovernanceTool": Params { target: "/governance" }. Use when user asks to open/view governance.
- "ViewReportsTool": Params { target: "/issues" }. Use when user asks to view issues or reports.
- "SelectRepositoryTool": Params { repoName: "owner/repo" }. Use when user selects a repository context.
- "NavigateTool": Params { target: "/path" }. Use to navigate to pages.

Rules:
1. Return JSON matching this exact structure:
{
  "intent": "Detected user intent summary",
  "thought": "Reasoning steps taken by agent",
  "actions": [
    {
      "tool": "ToolName",
      "params": { ... },
      "description": "Human readable action step"
    }
  ],
  "responseText": "Response text summarizing action start or answer"
}
2. Be concise and operational.
`;

export class SarvamBrowserAgent {
  public async planAndExecute(
    userMessage: string,
    context: ActionContext
  ): Promise<{ responseText: string; navigationTarget?: string; actionResults: any[] }> {
    const prompt = `
User Context:
${JSON.stringify(context, null, 2)}

User Request: "${userMessage}"

Generate plan and actions matching JSON schema.
`;

    let plan: AgentPlan;
    try {
      plan = await generateCompletion<AgentPlan>(prompt, {
        systemPrompt: AGENT_SYSTEM_PROMPT,
        responseFormat: { type: "json_object" },
        temperature: 0.1,
        useFastModel: true,
      });
    } catch {
      // Deterministic fallback intent matching
      plan = this.fallbackPlanner(userMessage, context);
    }

    const registry = ActionRegistry.getInstance();
    const actionResults: any[] = [];
    let navigationTarget: string | undefined;

    for (const action of plan.actions || []) {
      const result = await registry.executeTool(action.tool, action.params, context);
      actionResults.push(result);
      if (result.navigationTarget) {
        navigationTarget = result.navigationTarget;
      }
    }

    const summaryText = actionResults.map((r) => r.message).join("\n\n");
    const finalResponse = summaryText || plan.responseText || "Task completed successfully.";

    return {
      responseText: finalResponse,
      navigationTarget,
      actionResults,
    };
  }

  private fallbackPlanner(message: string, context: ActionContext): AgentPlan {
    const lower = message.toLowerCase();
    const actions: AgentPlan["actions"] = [];

    if (lower.includes("project")) {
      actions.push({
        tool: "NavigateTool",
        params: { target: "/projects" },
        description: "Open Projects Page",
      });
    } else if (lower.includes("dashboard")) {
      actions.push({
        tool: "NavigateTool",
        params: { target: "/dashboard" },
        description: "Open Main Dashboard",
      });
    } else if (lower.includes("governance")) {
      actions.push({
        tool: "OpenGovernanceTool",
        params: { target: "/governance" },
        description: "Open Governance Dashboard",
      });
    } else if (lower.includes("import") || lower.includes("repo")) {
      // Look for full owner/repo or clean spoken repo names
      const match = message.match(/([a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+)/);
      let repoName = match ? match[1] : undefined;

      if (!repoName) {
        // Remove voice noise digits/trailing spaces
        let cleanName = lower
          .replace(/import|repo|repository|and|run|through|pipeline/g, "")
          .replace(/[^a-zA-Z0-9_-]/g, "")
          .trim();

        // If cleanName is numeric or invalid like "1", fallback to acessDemo
        if (!cleanName || /^\d+$/.test(cleanName)) {
          cleanName = "acessDemo";
        }

        repoName = cleanName.includes("/") ? cleanName : `kachamsiddarth/${cleanName}`;
      }

      repoName = repoName || context.repoName || "kachamsiddarth/acessDemo";

      actions.push({
        tool: "ImportRepositoryTool",
        params: { repoName },
        description: `Import repository ${repoName}`,
      });

      if (lower.includes("pipeline") || lower.includes("run")) {
        actions.push({
          tool: "RunPipelineTool",
          params: { projectId: context.projectId },
          description: "Run accessibility analysis pipeline",
        });
      }
    } else if (lower.includes("pipeline") || lower.includes("run")) {
      actions.push({
        tool: "RunPipelineTool",
        params: { projectId: context.projectId },
        description: "Run accessibility analysis pipeline",
      });
    } else if (lower.includes("pr") || lower.includes("pull request")) {
      actions.push({
        tool: "CreatePRTool",
        params: { projectId: context.projectId, pipelineRunId: context.pipelineRunId },
        description: "Create Pull Request for fixes",
      });
    } else if (lower.includes("issue") || lower.includes("report")) {
      actions.push({
        tool: "ViewReportsTool",
        params: { target: "/issues" },
        description: "View Accessibility Issues",
      });
    }

    return {
      intent: "Automated Operator Intent",
      thought: "Using fallback intent planner",
      actions,
      responseText: "Executing requested application action...",
    };
  }
}
