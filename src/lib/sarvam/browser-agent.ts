import { generateCompletion } from "@/lib/ai/groq";
import type { AgentPlan, AgentToolType, ActionContext } from "./agent-types";
import { ActionRegistry } from "./action-registry";

const AGENT_SYSTEM_PROMPT = `
You are the Sarvam AI Browser Agent operating as an autonomous Product Operator for the AccessDiff platform.
Your objective is to translate natural language user requests into actionable tool executions using existing platform APIs and agents.

Available Tools:
- "ImportRepositoryTool": Params { repoName: "owner/repo" }. Use when user asks to import/add/setup/connect/monitor a GitHub repository.
- "RunPipelineTool": Params { projectId?: "id", baseCommit?: "sha", headCommit?: "sha" }. Use when user asks to run an accessibility audit/pipeline/comparison/scan.
- "CreatePRTool": Params { projectId?: "id", pipelineRunId?: "id", directCommit?: boolean }. Use when user asks to create a pull request or commit fixes.
- "ExplainViolationTool": Params { violationId: "id" }. Use when user asks to explain a specific accessibility issue/WCAG violation.
- "OptimizeFixesTool": Params { pipelineRunId?: "id" }. Use when user asks to optimize/fix failed fixes.
- "OpenGovernanceTool": Params { target: "/governance" }. Use when user asks to open/view governance or audit trail.
- "ViewReportsTool": Params { target: "/issues" }. Use when user asks to view issues or reports.
- "SelectRepositoryTool": Params { repoName: "owner/repo" }. Use ONLY when user explicitly changes their repository context without importing. Do NOT use this before ImportRepositoryTool.
- "NavigateTool": Params { target: "/path" }. Use to navigate to pages.

Output Rules:
1. Return ONLY valid JSON with this exact structure:
{
  "intent": "short intent summary",
  "thought": "1-2 sentences of reasoning",
  "actions": [ { "tool": "ToolName", "params": { ... }, "description": "Human readable step" } ],
  "responseText": "User-facing confirmation"
}
2. If the user asks to import a repo, emit a single ImportRepositoryTool action. Do NOT add a separate SelectRepositoryTool action.
3. If the user provides a bare repo name without an owner (e.g. "test2"), set repoName to the bare name — the executor will resolve the real owner from the user's GitHub account.
4. If no repo is mentioned for import, leave params.repoName as an empty string — the executor will pick the user's most recently updated GitHub repository.

Few-shot examples:
User: "import test2 repo"
-> { "intent":"import repo test2", "thought":"user wants to import repo named test2", "actions":[{"tool":"ImportRepositoryTool","params":{"repoName":"test2"},"description":"Import repository test2"}], "responseText":"Importing test2…" }

User: "import kachamsiddarth/acessDemo"
-> { "intent":"import acessDemo", "thought":"explicit owner/repo given", "actions":[{"tool":"ImportRepositoryTool","params":{"repoName":"kachamsiddarth/acessDemo"},"description":"Import kachamsiddarth/acessDemo"}], "responseText":"Starting import…" }

User: "add my portfolio repo and run pipeline"
-> { "intent":"import portfolio then run", "thought":"import portfolio then pipeline", "actions":[{"tool":"ImportRepositoryTool","params":{"repoName":"portfolio"},"description":"Import portfolio"},{"tool":"RunPipelineTool","params":{},"description":"Run pipeline"}], "responseText":"Importing and running audit…" }
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

Return the JSON plan.
`;

    let plan: AgentPlan;
    try {
      plan = await generateCompletion<AgentPlan>(prompt, {
        systemPrompt: AGENT_SYSTEM_PROMPT,
        responseFormat: { type: "json_object" },
        temperature: 0.1,
        useFastModel: true,
      });
      plan = this.normalizePlan(plan, userMessage, context);
    } catch {
      plan = this.fallbackPlanner(userMessage, context);
    }

    const registry = ActionRegistry.getInstance();
    const actionResults: any[] = [];
    let navigationTarget: string | undefined;

    for (const action of plan.actions || []) {
      const result = await registry.executeTool(action.tool, action.params ?? {}, context);
      actionResults.push(result);
      if (result.navigationTarget) {
        navigationTarget = result.navigationTarget;
      }
      // After an import action produces a project id, propagate it to downstream tools (pipeline/PR)
      if ((action.tool as string) === "ImportRepositoryTool" && result.success && result.data?.id) {
        context = { ...context, projectId: result.data.id };
      }
    }

    // Prefer final success result (import / run-pipeline / etc.) over silent context-update noise
    const meaningful = actionResults.filter(
      (r) => r && typeof r.message === "string" && !(r.message || "").toLowerCase().startsWith("context updated")
    );
    const summaryText = meaningful.length
      ? meaningful.map((r) => r.message).join("\n\n")
      : actionResults.map((r) => r.message).filter(Boolean).join("\n\n");
    const finalResponse = summaryText || plan.responseText || "Task completed successfully.";

    return {
      responseText: finalResponse,
      navigationTarget,
      actionResults,
    };
  }

  /**
   * Validate and normalize LLM-produced AgentPlan JSON so oddball shapes
   * still route to sensible actions instead of blowing up. Falls back to the
   * deterministic planner if the plan looks incomplete / has no valid actions.
   */
  private normalizePlan(plan: any, userMessage: string, context: ActionContext): AgentPlan {
    if (!plan || typeof plan !== "object") {
      return this.fallbackPlanner(userMessage, context);
    }

    const registeredTools = new Set<AgentToolType>([
      "ImportRepositoryTool",
      "RunPipelineTool",
      "GenerateFixesTool",
      "VerifyFixesTool",
      "CreatePRTool",
      "OpenGovernanceTool",
      "ExplainViolationTool",
      "OptimizeFixesTool",
      "SelectRepositoryTool",
      "SelectCommitsTool",
      "ViewReportsTool",
      "NavigateTool",
    ]);

    const rawActions = Array.isArray(plan.actions) ? plan.actions : [];
    const actions: AgentPlan["actions"] = rawActions
      .filter((a: any) => a && typeof a.tool === "string" && registeredTools.has(a.tool as AgentToolType))
      .map((a: any) => ({
        tool: a.tool as AgentToolType,
        params: a.params && typeof a.params === "object" ? a.params : {},
        description: typeof a.description === "string" ? a.description : `Executing ${a.tool}`,
      }));

    if (actions.length === 0) {
      return this.fallbackPlanner(userMessage, context);
    }

    return {
      intent: typeof plan.intent === "string" ? plan.intent : "AI planner intent",
      thought: typeof plan.thought === "string" ? plan.thought : "Plan normalized",
      actions,
      responseText: typeof plan.responseText === "string" ? plan.responseText : "Working on it…",
    };
  }

  /**
   * Extract a plausible repository name token from arbitrary user text.
   * Handles phrases like:
   *   "import test2 repo"        -> "test2"
   *   "add repository acessDemo then run audit" -> "acessDemo"
   *   "setup 3D_design repository"  -> "3D_design"
   *   "import kachamsiddarth/acessDemo" -> "kachamsiddarth/acessDemo"
   *   "monitor 3D-design project"     -> "3D_design"
   */
  private extractRepoToken(message: string): string | undefined {
    const text = message.trim();

    // 1) explicit owner/repo takes priority
    const fullMatch = text.match(/([a-zA-Z0-9-]+\/[a-zA-Z0-9_.-]+)/);
    if (fullMatch) return fullMatch[1];

    // 2) strip common intent verbs + filler words, leaving likely name
    const stripped = text
      .replace(/\b(import|add|setup|connect|monitor|load|open|check|please|pls|repo|repository|project|please|just|want|need|my|the|please)\b/gi, " ")
      .replace(/\b(and|then|run|audit|scan|pipeline|analysis|check|please)\b/gi, " ")
      .replace(/[^\p{L}\p{N}_-]/gu, " ")
      .trim();

    // 3) take the longest plausible name token (prefer with underscore/dash since those are GitHub-ish)
    const tokens = stripped.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return undefined;
    tokens.sort((a, b) => {
      const scoreA = (a.includes("_") || a.includes("-") ? 2 : 0) + a.length;
      const scoreB = (b.includes("_") || b.includes("-") ? 2 : 0) + b.length;
      return scoreB - scoreA;
    });
    const best = tokens[0];
    if (!best || /^\d+$/.test(best)) return undefined;
    return best;
  }

  private fallbackPlanner(message: string, context: ActionContext): AgentPlan {
    const lower = message.toLowerCase().trim();
    const actions: AgentPlan["actions"] = [];

    const importVerbs = /\b(import|add|setup|connect|monitor|load|link)\b/.test(lower);
    const repoNoun = /\b(repo|repos|repository|project|github)\b/.test(lower);
    const pipelineContextNouns = /\b(governance|dashboard|issue|report|pipeline|audit|scan|analysis)\b/.test(lower);
    const navigateToStaticNouns = /\b(projects?|dashboard|governance|issues?|reports?)\b/.test(lower);

    const hasImportIntent =
      (importVerbs && repoNoun) ||
      (importVerbs && !pipelineContextNouns && !navigateToStaticNouns) ||
      (repoNoun && !pipelineContextNouns && !navigateToStaticNouns);

    const hasPipelineIntent =
      /\b(run|start|launch|execute|audit|scan|check|analysis|compare)\b/.test(lower) ||
      /\bpipeline\b/.test(lower);

    if (hasImportIntent) {
      const token = this.extractRepoToken(message);
      const repoName: string = token ?? "";
      actions.push({
        tool: "ImportRepositoryTool",
        params: { repoName },
        description: token ? `Import repository ${repoName}` : "Import most recent repository",
      });
      if (hasPipelineIntent) {
        actions.push({
          tool: "RunPipelineTool",
          params: { projectId: context.projectId },
          description: "Run accessibility analysis pipeline",
        });
      }
    } else if (/\bprojects?\b/.test(lower) && !hasPipelineIntent) {
      actions.push({
        tool: "NavigateTool",
        params: { target: "/projects" },
        description: "Open Projects Page",
      });
    } else if (/\bdashboard\b/.test(lower) && !hasPipelineIntent) {
      actions.push({
        tool: "NavigateTool",
        params: { target: "/dashboard" },
        description: "Open Main Dashboard",
      });
    } else if (/\bgovernance\b/.test(lower)) {
      actions.push({
        tool: "OpenGovernanceTool",
        params: { target: "/governance" },
        description: "Open Governance Dashboard",
      });
    } else if (/\b(issues?|reports?)\b/.test(lower)) {
      actions.push({
        tool: "ViewReportsTool",
        params: { target: "/issues" },
        description: "View Accessibility Issues",
      });
    } else if (hasPipelineIntent) {
      actions.push({
        tool: "RunPipelineTool",
        params: { projectId: context.projectId },
        description: "Run accessibility analysis pipeline",
      });
    } else if (/\b(pr|pull request|merge)\b/.test(lower)) {
      actions.push({
        tool: "CreatePRTool",
        params: { projectId: context.projectId, pipelineRunId: context.pipelineRunId },
        description: "Create Pull Request for fixes",
      });
    } else {
      actions.push({
        tool: "NavigateTool",
        params: { target: "/dashboard" },
        description: "Open Dashboard",
      });
    }

    return {
      intent: "Automated Operator Intent",
      thought: "Using deterministic fallback intent planner",
      actions,
      responseText:
        actions.length > 0
          ? `Executing: ${actions.map((a) => a.description).join(" and ")}.`
          : "Executing requested application action...",
    };
  }
}
