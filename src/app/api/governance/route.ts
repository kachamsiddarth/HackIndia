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
    const agentFilter = searchParams.get("agent");
    const actionFilter = searchParams.get("action");
    const searchFilter = searchParams.get("search");

    const admin = createAdminClient();
    const recordsMap = new Map<string, {
      id: string;
      pipelineRunId: string;
      agentName: string;
      action: string;
      reasoning: string;
      confidence: number;
      metadata: Record<string, unknown> | null;
      createdAt: string;
    }>();

    // 1. Fetch from governance_records table (if table exists and has rows)
    try {
      const { data: recs } = await admin
        .from("governance_records")
        .select("*")
        .order("created_at", { ascending: false });

      if (recs && recs.length > 0) {
        for (const r of recs) {
          recordsMap.set(r.id, {
            id: r.id,
            pipelineRunId: r.pipeline_run_id ?? r.pipelineRunId ?? "",
            agentName: r.agent_name ?? r.agentName ?? "GovernanceAgent",
            action: r.action ?? "AUDIT_LOGGED",
            reasoning: r.reasoning ?? "AI decision recorded.",
            confidence: r.confidence ?? r.metadata?.confidence ?? 0.92,
            metadata: r.metadata ?? null,
            createdAt: r.created_at ?? new Date().toISOString(),
          });
        }
      }
    } catch {
      // Table governance_records might not exist or be empty
    }

    // 2. Fetch from governance_logs table (alternative schema name)
    try {
      const { data: logs } = await admin
        .from("governance_logs")
        .select("*")
        .order("created_at", { ascending: false });

      if (logs && logs.length > 0) {
        for (const l of logs) {
          recordsMap.set(l.id, {
            id: l.id,
            pipelineRunId: l.pipeline_run_id ?? "",
            agentName: l.agent_name ?? "GovernanceAgent",
            action: l.action ?? "AUDIT_LOGGED",
            reasoning: l.reasoning ?? "AI decision recorded.",
            confidence: l.confidence ?? 0.95,
            metadata: {
              trustScore: l.trust_score,
              riskLevel: l.risk_level,
              inputData: l.input_data,
              outputData: l.output_data,
            },
            createdAt: l.created_at ?? new Date().toISOString(),
          });
        }
      }
    } catch {
      // Table governance_logs might not exist or be empty
    }

    // 3. Synthesize from pipeline_stages (every agent execution stage in pipeline)
    try {
      const { data: stages } = await admin
        .from("pipeline_stages")
        .select("*")
        .order("created_at", { ascending: false });

      if (stages && stages.length > 0) {
        for (const s of stages) {
          if (!recordsMap.has(s.id)) {
            recordsMap.set(s.id, {
              id: s.id,
              pipelineRunId: s.pipeline_run_id ?? "",
              agentName: s.agent_name ?? stageToAgentName(s.stage_name),
              action: s.status === "completed" ? `${(s.stage_name || "STAGE").toUpperCase()}_COMPLETED` : `${(s.stage_name || "STAGE").toUpperCase()}_FAILED`,
              reasoning: s.error_message ?? `Stage ${s.stage_name ?? "analysis"} executed successfully with duration ${s.duration_ms ?? 0}ms.`,
              confidence: 0.92,
              metadata: {
                stageName: s.stage_name,
                durationMs: s.duration_ms,
                output: s.output_data,
              },
              createdAt: s.created_at ?? new Date().toISOString(),
            });
          }
        }
      }
    } catch {
      // pipeline_stages
    }

    // 4. Synthesize from fixes (every AI fix, verification, approval, rejection, rollback)
    try {
      const { data: fixes } = await admin
        .from("fixes")
        .select("*")
        .order("created_at", { ascending: false });

      if (fixes && fixes.length > 0) {
        for (const f of fixes) {
          const fixIdKey = `fix-${f.id}`;
          if (!recordsMap.has(fixIdKey)) {
            recordsMap.set(fixIdKey, {
              id: f.id,
              pipelineRunId: f.pipeline_run_id ?? "",
              agentName: "AccessibilityFixAgent",
              action: `FIX_${(f.status || "generated").toUpperCase()}`,
              reasoning: f.reasoning ?? `Generated code fix for file ${f.file_path}`,
              confidence: (f.trust_score ?? f.confidence ?? 85) / 100,
              metadata: {
                filePath: f.file_path,
                trustScore: f.trust_score,
                status: f.status,
                verificationResult: f.verification_result,
              },
              createdAt: f.updated_at ?? f.created_at ?? new Date().toISOString(),
            });
          }
        }
      }
    } catch {
      // fixes
    }

    // 5. Synthesize from pipeline_runs if nothing else returned
    if (recordsMap.size === 0) {
      try {
        const { data: runs } = await admin
          .from("pipeline_runs")
          .select("*")
          .order("created_at", { ascending: false });

        if (runs && runs.length > 0) {
          for (const r of runs) {
            recordsMap.set(r.id, {
              id: r.id,
              pipelineRunId: r.id,
              agentName: "HelixOrchestrator",
              action: `PIPELINE_${(r.status || "COMPLETED").toUpperCase()}`,
              reasoning: r.summary ?? r.error_message ?? `Pipeline execution ${r.status}. Discovered ${r.total_issues ?? 0} regressions and generated ${r.fixes_generated ?? 0} fixes.`,
              confidence: 0.95,
              metadata: {
                totalIssues: r.total_issues,
                fixesGenerated: r.fixes_generated,
                fixesVerified: r.fixes_verified,
                baseCommit: r.base_commit_sha,
                headCommit: r.head_commit_sha,
              },
              createdAt: r.created_at ?? new Date().toISOString(),
            });
          }
        }
      } catch {
        // pipeline_runs
      }
    }

    let records = Array.from(recordsMap.values());

    // Filter by agent if requested
    if (agentFilter && agentFilter !== "all") {
      const agentLower = agentFilter.toLowerCase();
      records = records.filter((r) => r.agentName.toLowerCase().includes(agentLower));
    }

    // Filter by action if requested
    if (actionFilter && actionFilter !== "all") {
      const actionLower = actionFilter.toLowerCase();
      records = records.filter((r) => r.action.toLowerCase().includes(actionLower));
    }

    // Filter by search query if requested
    if (searchFilter) {
      const queryLower = searchFilter.toLowerCase();
      records = records.filter(
        (r) =>
          r.agentName.toLowerCase().includes(queryLower) ||
          r.action.toLowerCase().includes(queryLower) ||
          r.reasoning.toLowerCase().includes(queryLower)
      );
    }

    // Sort descending by creation date
    records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
      data: { records },
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

function stageToAgentName(stageName?: string | null): string {
  switch (stageName?.toLowerCase()) {
    case "spec":
      return "RepositoryAgent";
    case "build":
      return "AccessibilityFixAgent";
    case "evaluate":
      return "VerificationAgent";
    case "diagnose":
      return "DiagnosisAgent";
    case "optimize":
      return "OptimizationAgent";
    case "governance":
      return "GovernanceAgent";
    default:
      return "HelixAgent";
  }
}
