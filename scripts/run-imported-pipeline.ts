import { executePipeline, createPipelineRun } from "@/lib/pipeline/service";
import { createAdminClient } from "@/lib/supabase/server";

const REPOSITORY = "kachamsiddarth/acessDemo";
const BASE_COMMIT = "7fb144b";
const HEAD_COMMIT = "525a5e6";

interface ImportedProject {
  id: string;
  user_id: string;
}

async function main(): Promise<void> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("projects")
    .select("id, user_id")
    .eq("github_repo", REPOSITORY)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) throw new Error(error?.message ?? `No imported project found for ${REPOSITORY}.`);
  const project = data as ImportedProject;
  const run = await createPipelineRun({
    projectId: project.id,
    userId: project.user_id,
    baseCommitSha: BASE_COMMIT,
    headCommitSha: HEAD_COMMIT,
  });

  console.log(`Created pipeline run ${run.id}.`);
  await executePipeline(run.id);
  console.log(`Pipeline run ${run.id} finished.`);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Pipeline runner failed.";
  console.error(message);
  process.exitCode = 1;
});
