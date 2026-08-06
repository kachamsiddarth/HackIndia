"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Card } from "@/components/ui/Card";
import {
  PipelineView,
  type PipelineRun,
  type PipelineResults,
} from "@/components/pipeline/PipelineView";

import styles from "./page.module.css";

/* ── Normalisation helpers ── */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getApiError(payload: unknown, fallback: string): string {
  if (isRecord(payload)) {
    if (typeof payload.error === "string") return payload.error;
    if (isRecord(payload.error) && typeof payload.error.message === "string") return payload.error.message;
  }

  return fallback;
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizeRun(value: unknown): PipelineRun | null {
  if (!isRecord(value) || typeof value.id !== "string") return null;
  const status = stringValue(value.status, "pending") as PipelineRun["status"];
  return {
    id: value.id,
    status,
    currentStage: stringValue(value.current_stage ?? value.currentStage) || null,
    totalIssues: numberValue(value.total_issues ?? value.totalIssues),
    newIssues: numberValue(value.new_issues ?? value.newIssues),
    fixesGenerated: numberValue(value.fixes_generated ?? value.fixesGenerated),
    fixesVerified: numberValue(value.fixes_verified ?? value.fixesVerified),
    summary: stringValue(value.summary) || null,
    errorMessage: stringValue(value.error_message ?? value.errorMessage) || null,
    createdAt: stringValue(value.created_at ?? value.createdAt),
    startedAt: stringValue(value.started_at ?? value.startedAt) || null,
    completedAt: stringValue(value.completed_at ?? value.completedAt) || null,
  };
}

function normalizeResults(value: unknown): PipelineResults | null {
  if (!isRecord(value)) return null;
  const run = normalizeRun(value.run);
  if (!run) return null;

  const stages = arrayValue(value.stages).flatMap((stage): PipelineResults["stages"] => {
    if (!isRecord(stage) || typeof stage.id !== "string") return [];
    return [{
      id: stage.id,
      stageName: stringValue(stage.stage_name),
      agentName: stringValue(stage.agent_name),
      status: stringValue(stage.status, "pending") as PipelineRun["status"],
      input: isRecord(stage.input) ? stage.input : null,
      output: isRecord(stage.output) ? stage.output : null,
      errorMessage: stringValue(stage.error_message) || null,
      startedAt: stringValue(stage.started_at) || null,
      completedAt: stringValue(stage.completed_at) || null,
    }];
  });
  const issues = arrayValue(value.issues).flatMap((issue): PipelineResults["issues"] => {
    if (!isRecord(issue) || typeof issue.id !== "string") return [];
    const severity = stringValue(issue.severity, "moderate") as PipelineResults["issues"][number]["severity"];
    return [{
      id: issue.id,
      ruleId: stringValue(issue.raw_rule_id ?? issue.wcag_rule),
      wcagCriteria: stringValue(issue.wcag_rule) || null,
      severity,
      message: stringValue(issue.message),
      filePath: stringValue(issue.file_path),
      lineNumber: typeof issue.line_number === "number" ? issue.line_number : null,
    }];
  });
  const fixes = arrayValue(value.fixes).flatMap((fix): PipelineResults["fixes"] => {
    if (!isRecord(fix) || typeof fix.id !== "string" || typeof fix.issue_id !== "string") return [];
    return [{
      id: fix.id,
      issueId: fix.issue_id,
      status: stringValue(fix.status, "proposed") as PipelineResults["fixes"][number]["status"],
      diffPatch: stringValue(fix.diff_patch),
      rationale: stringValue(fix.rationale) || null,
    }];
  });

  return { run, stages, issues, fixes };
}

/* ── Display helpers ── */

function shortSha(sha: string): string {
  return sha.slice(0, 8);
}

/* ── Page inner component (needs useSearchParams → Suspense boundary) ── */

function PipelineContent(): React.ReactNode {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");
  const baseCommitSha = searchParams.get("base");
  const headCommitSha = searchParams.get("head");
  const hasStarted = useRef(false);

  const [run, setRun] = useState<PipelineRun | null>(null);
  const [results, setResults] = useState<PipelineResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const queryError = !projectId || !baseCommitSha || !headCommitSha
    ? "This pipeline link is incomplete. Select two commits from the project page and try again."
    : baseCommitSha === headCommitSha
      ? "Choose two different commits before starting the pipeline."
      : null;
  const runId = run?.id;
  const runStatus = run?.status;

  useEffect(() => {
    if (queryError) return;

    if (hasStarted.current) return;
    hasStarted.current = true;

    async function startPipeline() {
      try {
        const response = await fetch("/api/pipeline/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, baseCommitSha, headCommitSha }),
        });
        const payload: unknown = await response.json();

        const nextRun = isRecord(payload) ? normalizeRun(payload.data) : null;
        if (!response.ok || !nextRun) {
          throw new Error(getApiError(payload, "Unable to start the pipeline."));
        }

        setRun(nextRun);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Unable to start the pipeline.");
      } finally {
        setLoading(false);
      }
    }

    void startPipeline();
  }, [baseCommitSha, headCommitSha, projectId, queryError]);

  useEffect(() => {
    if (!runId || !runStatus) return;

    let stream: EventSource | null = null;
    let stopped = false;

    async function loadResults(runId: string) {
      const response = await fetch(`/api/pipeline/${runId}/results`);
      const payload: unknown = await response.json();

      const nextResults = isRecord(payload) ? normalizeResults(payload.data) : null;
      if (!response.ok || !nextResults) {
        throw new Error(getApiError(payload, "Unable to load pipeline results."));
      }

      setResults(nextResults);
    }

    if (runStatus === "completed" || runStatus === "failed" || runStatus === "cancelled") {
      void loadResults(runId).catch((caught: unknown) => {
        if (!stopped) setError(caught instanceof Error ? caught.message : "Unable to load pipeline results.");
      });
      return;
    }

    stream = new EventSource(`/api/pipeline/${runId}/stream`);
    stream.addEventListener("status", (event) => {
      const nextRun: unknown = JSON.parse((event as MessageEvent<string>).data);
      const normalizedRun = normalizeRun(nextRun);
      if (normalizedRun) setRun(normalizedRun);
    });
    stream.addEventListener("complete", (event) => {
      const nextRun: unknown = JSON.parse((event as MessageEvent<string>).data);
      const normalizedRun = normalizeRun(nextRun);
      if (normalizedRun) setRun(normalizedRun);
      stream?.close();
    });
    stream.addEventListener("error", (event) => {
      const payload: unknown = JSON.parse((event as MessageEvent<string>).data);
      if (isRecord(payload)) setError(getApiError(payload, "The pipeline stream disconnected."));
      stream?.close();
    });

    return () => {
      stopped = true;
      stream?.close();
    };
  }, [runId, runStatus]);

  const displayError = queryError ?? error;

  return (
    <main className={styles.page}>
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Accessibility pipeline</p>
          <h1>Regression analysis</h1>
          <p className={styles.description}>
            Comparing <code>{baseCommitSha ? shortSha(baseCommitSha) : "—"}</code> to <code>{headCommitSha ? shortSha(headCommitSha) : "—"}</code>.
          </p>
        </div>
        <Link className={styles.backLink} href={projectId ? `/projects/${projectId}` : "/projects"}>Back to project</Link>
      </div>

      <PipelineView
        run={run}
        results={results}
        error={displayError}
        loading={loading && !queryError}
      />
      {projectId && run?.status === "completed" && results?.fixes.length ? (
        <div className={styles.diffAction}>
          <Link className={styles.diffLink} href={`/projects/${projectId}/diff`}>
            Review code diffs and AI fixes
          </Link>
        </div>
      ) : null}
    </main>
  );
}

export default function PipelinePage(): React.ReactNode {
  return (
    <Suspense fallback={<main className={styles.page}><Card className={styles.statusCard}><p className={styles.loading}>Loading pipeline…</p></Card></main>}>
      <PipelineContent />
    </Suspense>
  );
}
