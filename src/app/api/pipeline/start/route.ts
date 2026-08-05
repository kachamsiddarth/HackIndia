import { after } from "next/server";
import { NextResponse } from "next/server";
import { createPipelineRun, executePipeline } from "@/lib/pipeline/service";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

interface StartPipelineRequest {
  projectId: string;
  baseCommitSha: string;
  headCommitSha: string;
}

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorizedResponse();

  try {
    const body: unknown = await request.json();
    const input = parseStartRequest(body);
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id")
      .eq("id", input.projectId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (projectError || !project) {
      return NextResponse.json(
        { data: null, error: { message: "Project not found.", code: "PROJECT_NOT_FOUND" } },
        { status: 404 }
      );
    }

    const run = await createPipelineRun({ ...input, userId: user.id });
    after(async () => executePipeline(run.id));
    return NextResponse.json({ data: run, error: null }, { status: 202 });
  } catch (caught: unknown) {
    const message = caught instanceof Error ? caught.message : "Unable to start the pipeline.";
    return NextResponse.json({ data: null, error: { message, code: "PIPELINE_START_FAILED" } }, { status: 400 });
  }
}

function parseStartRequest(body: unknown): StartPipelineRequest {
  if (!isRecord(body)) throw new Error("Request body must be a JSON object.");
  const projectId = body.projectId;
  const baseCommitSha = body.baseCommitSha;
  const headCommitSha = body.headCommitSha;
  if (!isNonEmptyString(projectId) || !isNonEmptyString(baseCommitSha) || !isNonEmptyString(headCommitSha)) {
    throw new Error("projectId, baseCommitSha, and headCommitSha are required.");
  }
  if (baseCommitSha === headCommitSha) throw new Error("Base and head commits must be different.");
  return { projectId, baseCommitSha, headCommitSha };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function unauthorizedResponse(): NextResponse {
  return NextResponse.json(
    { data: null, error: { message: "Unauthorized", code: "UNAUTHORIZED" } },
    { status: 401 }
  );
}
