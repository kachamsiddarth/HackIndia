"use client";

import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import type { PipelineStage, PipelineStatus } from "../PipelineView/PipelineView";
import styles from "./StageCard.module.css";

export interface StageCardProps {
  stage: PipelineStage;
  defaultExpanded?: boolean;
  durationMs?: number;
}

function statusVariant(status: PipelineStatus): "success" | "error" | "warning" | "neutral" {
  if (status === "completed") return "success";
  if (status === "failed" || status === "cancelled") return "error";
  if (status === "running") return "warning";
  return "neutral";
}

function formatStageName(name: string): string {
  if (!name) return "Unknown Stage";
  return name.replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDuration(ms?: number | null): string | null {
  if (!ms || ms <= 0) return null;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Displays an individual ADL pipeline stage execution card with status, duration,
 * and collapsible input/output payload details.
 */
export default function StageCard({
  stage,
  defaultExpanded = false,
  durationMs,
}: StageCardProps): ReactNode {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const cardClass = [
    styles.stageCard,
    styles[stage.status] ?? styles.pending,
  ].join(" ");

  const hasContent = Boolean(stage.input || stage.output || stage.errorMessage);
  const formattedDuration = formatDuration(durationMs);

  return (
    <div className={cardClass}>
      <button
        type="button"
        className={styles.header}
        onClick={() => hasContent && setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-controls={`stage-content-${stage.id}`}
        disabled={!hasContent}
      >
        <div className={styles.leftInfo}>
          <h3 className={styles.stageName}>{formatStageName(stage.stageName)}</h3>
          {stage.agentName && (
            <span className={styles.agentName}>({stage.agentName})</span>
          )}
        </div>

        <div className={styles.rightInfo}>
          {formattedDuration && (
            <span className={styles.duration}>{formattedDuration}</span>
          )}
          <Badge variant={statusVariant(stage.status)} size="sm">
            {stage.status}
          </Badge>

          {hasContent && (
            <svg
              className={`${styles.chevron} ${isExpanded ? styles.chevronExpanded : ""}`}
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          )}
        </div>
      </button>

      {isExpanded && hasContent && (
        <div id={`stage-content-${stage.id}`} className={styles.content}>
          {stage.errorMessage && (
            <div className={styles.errorBlock}>
              <strong>Error:</strong> {stage.errorMessage}
            </div>
          )}

          {stage.input && (
            <div className={styles.dataBlock}>
              <p className={styles.dataTitle}>Input Payload</p>
              <pre className={styles.jsonPre}>{JSON.stringify(stage.input, null, 2)}</pre>
            </div>
          )}

          {stage.output && (
            <div className={styles.dataBlock}>
              <p className={styles.dataTitle}>Output Results</p>
              <pre className={styles.jsonPre}>{JSON.stringify(stage.output, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
