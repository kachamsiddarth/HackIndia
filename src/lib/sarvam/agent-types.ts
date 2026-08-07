export type AgentToolType = 
  | "ImportRepositoryTool"
  | "RunPipelineTool"
  | "GenerateFixesTool"
  | "VerifyFixesTool"
  | "CreatePRTool"
  | "OpenGovernanceTool"
  | "ExplainViolationTool"
  | "OptimizeFixesTool"
  | "SelectRepositoryTool"
  | "SelectCommitsTool"
  | "ViewReportsTool"
  | "NavigateTool";

export interface AgentActionCall {
  tool: AgentToolType;
  params: Record<string, any>;
  description: string;
}

export interface AgentPlan {
  intent: string;
  thought: string;
  actions: AgentActionCall[];
  responseText: string;
}

export interface ActionContext {
  userId: string;
  projectId?: string;
  repoName?: string;
  baseCommit?: string;
  headCommit?: string;
  pipelineRunId?: string;
  currentPath?: string;
}

export interface ActionResult {
  success: boolean;
  message: string;
  data?: any;
  navigationTarget?: string;
  /**
   * For ImportRepositoryTool: set to true when the requested project was
   * already imported by this user, so no new row was written.  Callers
   * can use this flag to skip duplicate-success toasts or skip pipeline
   * re-runs that were already queued against the existing project.
   */
  alreadyImported?: boolean;
}
