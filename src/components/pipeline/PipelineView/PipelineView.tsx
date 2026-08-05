"use client";

import { type ReactNode } from "react";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { StageCard } from "../StageCard";
import { ProgressIndicator } from "../ProgressIndicator";

import styles from "./PipelineView.module.css";

/* ── Shared type definitions ── */

export type PipelineStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface PipelineRun {
  id: string;
  status: PipelineStatus;
  currentStage: string | null;
  totalIssues: number;
  newIssues: number;
  fixesGenerated: number;
  fixesVerified: number;
  summary: string | null;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface PipelineStage {
  id: string;
  stageName: string;
  agentName: string;
  status: PipelineStatus;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface PipelineIssue {
  id: string;
  ruleId: string;
  wcagCriteria: string | null;
  severity: "critical" | "serious" | "moderate" | "minor";
  message: string;
  filePath: string;
  lineNumber: number | null;
}

export interface PipelineFix {
  id: string;
  issueId: string;
  status: "proposed" | "applied" | "verified" | "rejected" | "failed";
  diffPatch: string;
  rationale: string | null;
}

export interface PipelineResults {
  run: PipelineRun;
  stages: PipelineStage[];
  issues: PipelineIssue[];
  fixes: PipelineFix[];
}

/* ── Component props ── */

export interface PipelineViewProps {
  /** The active pipeline run, or `null` when no run has been created yet. */
  run: PipelineRun | null;
  /** Fully loaded pipeline results (issues, fixes, stages). Shown once the run is terminal. */
  results: PipelineResults | null;
  /** A user-facing error message. Displayed prominently above the status card. */
  error: string | null;
  /** Whether the initial pipeline-start request is still in flight. */
  loading: boolean;
}

/* ── Helpers ── */

function statusVariant(status: PipelineStatus): "success" | "error" | "warning" | "neutral" {
  if (status === "completed") return "success";
  if (status === "failed" || status === "cancelled") return "error";
  if (status === "running") return "warning";
  return "neutral";
}

function formatStage(stage: string | null): string {
  if (!stage) return "Preparing pipeline";
  return stage.replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/* ── Component ── */

/**
 * Reusable pipeline run/status UI.
 *
 * Renders the loading state, error card, progress indicator, live status card with metrics,
 * ADL stage breakdown cards, and the results section (detected issues + generated fixes).
 */
export default function PipelineView({
  run,
  results,
  error,
  loading,
}: PipelineViewProps): ReactNode {
  const isTerminal = run?.status === "completed" || run?.status === "failed" || run?.status === "cancelled";
  const visibleResults = results ?? (isTerminal && run ? { run, stages: [], issues: [], fixes: [] } : null);

  const stagesList = visibleResults?.stages ?? [];

  return (
    <>
      {/* ── Error card ── */}
      {error ? (
        <Card className={styles.errorCard}>
          <h2>Pipeline could not start</h2>
          <p>{error}</p>
        </Card>
      ) : null}

      {/* ── Loading state ── */}
      {loading && !error ? (
        <Card className={styles.statusCard}>
          <p className={styles.loading}>Creating an analysis run…</p>
        </Card>
      ) : null}

      {/* ── Progress Indicator & Status card ── */}
      {run ? (
        <>
          <ProgressIndicator
            currentStageId={run.currentStage}
            steps={stagesList.map((s) => ({
              id: s.id,
              label: s.stageName,
              status: s.status,
            }))}
          />

          <Card className={styles.statusCard}>
            <div className={styles.statusHeader}>
              <div>
                <p className={styles.label}>Current status</p>
                <h2>{formatStage(run.currentStage)}</h2>
              </div>
              <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
            </div>
            <p className={styles.runId}>Run {run.id}</p>
            <div className={styles.metrics} role="group" aria-label="Pipeline metrics">
              <div><strong>{run.totalIssues}</strong><span>Issues found</span></div>
              <div><strong>{run.fixesGenerated}</strong><span>Fixes generated</span></div>
              <div><strong>{run.fixesVerified}</strong><span>Fixes verified</span></div>
            </div>
            {run.summary ? <p className={styles.summary}>{run.summary}</p> : null}
            {run.errorMessage ? <p className={styles.pipelineError}>{run.errorMessage}</p> : null}
          </Card>
        </>
      ) : null}

      {/* ── Stages Execution Breakdown ── */}
      {stagesList.length > 0 && (
        <Card className={styles.statusCard}>
          <div className={styles.sectionHeading} style={{ marginBottom: "1rem" }}>
            <div>
              <p className={styles.label}>Execution Pipeline</p>
              <h2>Mutagent Helix ADL Stages</h2>
            </div>
          </div>
          {stagesList.map((stage) => (
            <StageCard key={stage.id} stage={stage} />
          ))}
        </Card>
      )}

      {/* ── Results section ── */}
      {visibleResults ? (
        <section className={styles.results} aria-label="Pipeline results">
          <Card>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.label}>Detected regressions</p>
                <h2>{visibleResults.issues.length} accessibility issues</h2>
              </div>
            </div>
            {visibleResults.issues.length ? (
              <ul className={styles.itemList}>
                {visibleResults.issues.map((issue) => (
                  <li key={issue.id}>
                    <div>
                      <strong>{issue.message}</strong>
                      <span>{issue.filePath}{issue.lineNumber ? `:${issue.lineNumber}` : ""} · {issue.wcagCriteria ?? issue.ruleId}</span>
                    </div>
                    <Badge variant={issue.severity === "critical" || issue.severity === "serious" ? "error" : "warning"}>{issue.severity}</Badge>
                  </li>
                ))}
              </ul>
            ) : <p className={styles.empty}>No newly introduced accessibility issues were found.</p>}
          </Card>

          <Card>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.label}>Suggested remediations</p>
                <h2>{visibleResults.fixes.length} generated fixes</h2>
              </div>
            </div>
            {visibleResults.fixes.length ? (
              <ul className={styles.itemList}>
                {visibleResults.fixes.map((fix) => (
                  <li key={fix.id}>
                    <div>
                      <strong>{fix.rationale ?? "Accessibility fix"}</strong>
                      <span>Linked issue {fix.issueId.slice(0, 8)}</span>
                    </div>
                    <Badge variant={fix.status === "verified" ? "success" : "neutral"}>{fix.status}</Badge>
                  </li>
                ))}
              </ul>
            ) : <p className={styles.empty}>No automated fixes were generated for this run.</p>}
          </Card>
        </section>
      ) : null}
    </>
  );
}
