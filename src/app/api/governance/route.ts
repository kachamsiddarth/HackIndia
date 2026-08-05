import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function GET(request: Request): Promise<NextResponse> {
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
    const { searchParams } = new URL(request.url);
    const agent = searchParams.get("agent");
    const action = searchParams.get("action");
    const search = searchParams.get("search");

    const admin = createAdminClient();

    let query = admin
      .from("governance_records")
      .select("*")
      .order("created_at", { ascending: false });

    if (agent && agent !== "all") {
      query = query.eq("agent_name", agent);
    }

    if (action && action !== "all") {
      query = query.eq("action", action);
    }

    const { data: recordsData, error: recErr } = await query;
    if (recErr) throw new Error(recErr.message);

    let records = recordsData ?? [];

    // Fallback: If governance_records table has no rows, fetch from pipeline_stages
    if (records.length === 0) {
      let stagesQuery = admin
        .from("pipeline_stages")
        .select("*")
        .order("created_at", { ascending: false });

      if (agent && agent !== "all") {
        stagesQuery = stagesQuery.eq("agent_name", agent);
      }

      const { data: stagesData } = await stagesQuery;
      if (stagesData && stagesData.length > 0) {
        records = stagesData.map((s) => ({
          id: s.id,
          pipeline_run_id: s.pipeline_run_id,
          agent_name: s.agent_name,
          action: s.status === "completed" ? "STAGE_COMPLETED" : "STAGE_FAILED",
          reasoning: s.error_message ?? `Stage ${s.stage_name} executed successfully in ${s.duration_ms ?? 0}ms`,
          metadata: {
            confidence: 0.95,
            stageName: s.stage_name,
            durationMs: s.duration_ms,
            outputData: s.output_data,
          },
          created_at: s.created_at,
        }));
      }
    }

    if (search) {
      const searchLower = search.toLowerCase();
      records = records.filter(
        (r) =>
          r.agent_name?.toLowerCase().includes(searchLower) ||
          r.action?.toLowerCase().includes(searchLower) ||
          r.reasoning?.toLowerCase().includes(searchLower)
      );
    }

    const formattedRecords = records.map((r) => ({
      id: r.id,
      pipelineRunId: r.pipeline_run_id,
      agentName: r.agent_name,
      action: r.action,
      reasoning: r.reasoning,
      confidence: r.metadata?.confidence ?? 0.9,
      metadata: r.metadata,
      createdAt: r.created_at,
    }));

    return NextResponse.json({
      data: { records: formattedRecords },
      error: null,
    });
  } catch (caught: unknown) {
    const message = caught instanceof Error ? caught.message : "Failed to fetch governance records.";
    return NextResponse.json(
      { data: null, error: { message, code: "FETCH_GOVERNANCE_FAILED" } },
      { status: 500 }
    );
  }
}
