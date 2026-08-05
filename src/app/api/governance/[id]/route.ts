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

    // 1. Try governance_records
    try {
      const { data: record } = await admin
        .from("governance_records")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (record) {
        return NextResponse.json({
          data: {
            id: record.id,
            pipelineRunId: record.pipeline_run_id ?? record.pipelineRunId ?? "",
            agentName: record.agent_name ?? record.agentName ?? "GovernanceAgent",
            action: record.action ?? "AUDIT_LOGGED",
            reasoning: record.reasoning ?? "AI decision recorded.",
            confidence: record.confidence ?? record.metadata?.confidence ?? 0.9,
            metadata: record.metadata ?? null,
            createdAt: record.created_at ?? new Date().toISOString(),
          },
          error: null,
        });
      }
    } catch {
      // Ignore
    }

    // 2. Try governance_logs
    try {
      const { data: log } = await admin
        .from("governance_logs")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (log) {
        return NextResponse.json({
          data: {
            id: log.id,
            pipelineRunId: log.pipeline_run_id ?? "",
            agentName: log.agent_name ?? "GovernanceAgent",
            action: log.action ?? "AUDIT_LOGGED",
            reasoning: log.reasoning ?? "AI decision recorded.",
            confidence: log.confidence ?? 0.95,
            metadata: {
              trustScore: log.trust_score,
              riskLevel: log.risk_level,
              inputData: log.input_data,
              outputData: log.output_data,
            },
            createdAt: log.created_at ?? new Date().toISOString(),
          },
          error: null,
        });
      }
    } catch {
      // Ignore
    }

    // 3. Try pipeline_stages
    try {
      const { data: stage } = await admin
        .from("pipeline_stages")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (stage) {
        return NextResponse.json({
          data: {
            id: stage.id,
            pipelineRunId: stage.pipeline_run_id ?? "",
            agentName: stage.agent_name ?? "HelixAgent",
            action: stage.status === "completed" ? `${(stage.stage_name || "STAGE").toUpperCase()}_COMPLETED` : `${(stage.stage_name || "STAGE").toUpperCase()}_FAILED`,
            reasoning: stage.error_message ?? `Stage ${stage.stage_name} executed successfully in ${stage.duration_ms ?? 0}ms`,
            confidence: 0.95,
            metadata: {
              stageName: stage.stage_name,
              durationMs: stage.duration_ms,
              outputData: stage.output_data,
            },
            createdAt: stage.created_at ?? new Date().toISOString(),
          },
          error: null,
        });
      }
    } catch {
      // Ignore
    }

    // 4. Try fixes
    try {
      const { data: fix } = await admin
        .from("fixes")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (fix) {
        return NextResponse.json({
          data: {
            id: fix.id,
            pipelineRunId: fix.pipeline_run_id ?? "",
            agentName: "AccessibilityFixAgent",
            action: `FIX_${(fix.status || "generated").toUpperCase()}`,
            reasoning: fix.reasoning ?? `Generated code fix for file ${fix.file_path}`,
            confidence: (fix.trust_score ?? fix.confidence ?? 85) / 100,
            metadata: {
              filePath: fix.file_path,
              trustScore: fix.trust_score,
              status: fix.status,
              verificationResult: fix.verification_result,
            },
            createdAt: fix.updated_at ?? fix.created_at ?? new Date().toISOString(),
          },
          error: null,
        });
      }
    } catch {
      // Ignore
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
