"use client";

import Link from "next/link";
import { use, useEffect, useState, useCallback } from "react";
import { ScoreGauge, TimelineChart, type TimelineDataPoint } from "@/components/timeline";
import { PRPanel } from "@/components/pull-requests";
import { Skeleton } from "@/components/ui";
import styles from "./page.module.css";

interface TimelinePageProps {
  params: Promise<{ id: string }>;
}

interface RunEvent {
  id: string;
  status: string;
  totalIssues: number;
  fixesGenerated: number;
  fixesVerified: number;
  summary: string;
  createdAt: string;
}

export default function ProjectTimelinePage(props: TimelinePageProps) {
  const { id: projectId } = use(props.params);

  const [scores, setScores] = useState<TimelineDataPoint[]>([]);
  const [runs, setRuns] = useState<RunEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTimeline = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/timeline`);
      const json = await res.json();
      if (json.data) {
        setScores(json.data.scores || []);
        // Sort runs newest-first for correct display
        const sorted = [...(json.data.runs || [])].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setRuns(sorted);
      }
    } catch (err) {
      console.error("Failed to load timeline:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    void loadTimeline();
    // Live polling every 8 seconds so pipeline status updates in real-time
    const interval = setInterval(() => void loadTimeline(), 8000);
    return () => clearInterval(interval);
  }, [loadTimeline]);

  const latestScore = scores.length > 0 ? scores[scores.length - 1].score : null;

  // Pick the most recent run that actually has fixes generated (not an empty legacy run)
  const latestRunWithFixes = runs.find((r) => r.fixesGenerated > 0 && r.status === "completed");
  const latestRunId = latestRunWithFixes?.id ?? runs[0]?.id;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Accessibility Compliance Timeline</h1>
        </div>
        <Link href={`/projects/${projectId}`} className={styles.backLink}>
          Back to project
        </Link>
      </div>

      {loading ? (
        <Skeleton height={200} />
      ) : (
        <div className={styles.overviewGrid}>
          <ScoreGauge score={latestScore ?? 0} />
          <TimelineChart scores={scores} />
        </div>
      )}

      <PRPanel projectId={projectId} pipelineRunId={latestRunId} />

      <div className={styles.runsSection}>
        <h2 className={styles.sectionTitle}>Pipeline Execution History</h2>

        {loading ? (
          <Skeleton height={150} />
        ) : runs.length > 0 ? (
          <div className={styles.runList}>
            {runs.map((run) => (
              <div key={run.id} className={styles.runCard}>
                <div className={styles.runInfo}>
                  <span className={styles.runTitle}>Pipeline Run #{run.id.slice(0, 8)}</span>
                  <span className={styles.runSub}>
                    {run.summary || `Discovered ${run.totalIssues} regressions, verified ${run.fixesVerified} fixes.`}
                  </span>
                </div>
                <span
                  className={`${styles.statusBadge} ${
                    run.status === "completed" ? styles.statusCompleted : styles.statusFailed
                  }`}
                >
                  {run.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: "var(--color-text-tertiary)", fontSize: "0.85rem" }}>
            No pipeline executions recorded yet.
          </p>
        )}
      </div>
    </div>
  );
}
