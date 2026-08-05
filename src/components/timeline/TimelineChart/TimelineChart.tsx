"use client";

import { type ReactNode } from "react";
import styles from "./TimelineChart.module.css";

export interface TimelineDataPoint {
  id: string;
  commitSha?: string;
  score: number;
  totalIssues?: number;
  measuredAt: string;
}

export interface TimelineChartProps {
  scores: TimelineDataPoint[];
}

export default function TimelineChart({ scores }: TimelineChartProps): ReactNode {
  if (scores.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <span className={styles.title}>Accessibility Score History</span>
        </div>
        <p style={{ color: "var(--color-text-tertiary)", fontSize: "0.85rem", margin: 0 }}>
          No score history recorded yet. Run pipeline analyses to build your compliance timeline.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Accessibility Score History</span>
      </div>

      <div className={styles.chartArea}>
        {scores.map((point) => {
          const heightPercent = Math.max(10, Math.min(100, point.score));
          const dateStr = new Date(point.measuredAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          });

          return (
            <div key={point.id} className={styles.barCol}>
              <span className={styles.scoreLabel}>{point.score}%</span>
              <div className={styles.barTrack}>
                <div
                  className={styles.barFill}
                  style={{ height: `${heightPercent}%` }}
                />
              </div>
              <span className={styles.dateLabel}>{dateStr}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
