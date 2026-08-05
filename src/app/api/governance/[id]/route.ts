import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { data: null, error: { message: "Unauthorized", code: "UNAUTHORIZED" } },
      { status: 401 }
    );
  }

  try {
    const admin = createAdminClient();

    const { data: record } = await admin
      .from("governance_records")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (record) {
      return NextResponse.json({
        data: {
          id: record.id,
          pipelineRunId: record.pipeline_run_id,
          agentName: record.agent_name,
          action: record.action,
          reasoning: record.reasoning,
          confidence: record.metadata?.confidence ?? 0.9,
          metadata: record.metadata,
          createdAt: record.created_at,
        },
        error: null,
      });
    }

    // Fallback: check pipeline_stages if not found in governance_records
    const { data: stage } = await admin
      .from("pipeline_stages")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (stage) {
      return NextResponse.json({
        data: {
          id: stage.id,
          pipelineRunId: stage.pipeline_run_id,
          agentName: stage.agent_name,
          action: stage.status === "completed" ? "STAGE_COMPLETED" : "STAGE_FAILED",
          reasoning: stage.error_message ?? `Stage ${stage.stage_name} executed successfully in ${stage.duration_ms ?? 0}ms`,
          confidence: 0.95,
          metadata: {
            confidence: 0.95,
            stageName: stage.stage_name,
            durationMs: stage.duration_ms,
            outputData: stage.output_data,
          },
          createdAt: stage.created_at,
        },
        error: null,
      });
    }

    return NextResponse.json(
      { data: null, error: { message: "Governance record not found", code: "NOT_FOUND" } },
      { status: 404 }
    );
  } catch (caught: unknown) {
    const message = caught instanceof Error ? caught.message : "Failed to fetch governance record.";
    return NextResponse.json(
      { data: null, error: { message, code: "FETCH_GOVERNANCE_DETAIL_FAILED" } },
      { status: 500 }
    );
  }
}
