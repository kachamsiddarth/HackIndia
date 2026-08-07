import { Mutagent } from "@mutagent/sdk";

export const mutagentClient = new Mutagent({
  security: {
    apiKey: process.env.MUTAGENT_API_KEY ?? "",
  },
});

/**
 * Dynamically resolves active user organization and fetches workspaces
 * with x-organization-id header context without hardcoding IDs.
 */
export async function getMutagentWorkspaces() {
  const orgsPage = await mutagentClient.organizations.listOrganizations();
  const orgList = (orgsPage as unknown as { result?: { data?: Array<{ id?: string }> } }).result?.data ?? [];
  const activeOrgId = orgList[0]?.id;

  const options = activeOrgId ? { headers: { "x-organization-id": activeOrgId } } : {};
  return mutagentClient.workspaces.listWorkspaces({}, options);
}

export interface PipelineStageResult {
  stage: "SPEC" | "BUILD" | "EVALUATE" | "DIAGNOSE" | "OPTIMIZE";
  agentName: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  confidence: number;
  output: unknown;
  duration_ms: number;
}

