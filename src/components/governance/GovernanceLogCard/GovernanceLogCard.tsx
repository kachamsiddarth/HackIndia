"use client";

import { type ReactNode } from "react";
import styles from "./GovernanceLogCard.module.css";

export interface GovernanceRecord {
  id: string;
  pipelineRunId: string;
  agentName: string;
  action: string;
  reasoning: string;
  confidence: number;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface GovernanceLogCardProps {
  record: GovernanceRecord;
  onSelect?: (record: GovernanceRecord) => void;
}

/**
 * Renders a single AI governance audit log entry with agent name, action, reasoning, and confidence.
 */
export default function GovernanceLogCard({
  record,
  onSelect,
}: GovernanceLogCardProps): ReactNode {
  const confidencePercent = Math.round((record.confidence > 1 ? record.confidence : record.confidence * 100));
  const confidenceClass =
    confidencePercent >= 85 ? styles.high : confidencePercent >= 65 ? styles.medium : styles.low;

  const formattedDate = new Date(record.createdAt).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className={styles.card}
      onClick={() => onSelect?.(record)}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={(e) => {
        if (onSelect && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onSelect(record);
        }
      }}
    >
      <div className={styles.header}>
        <span className={styles.agentName}>{record.agentName}</span>
        <span className={styles.action}>{record.action}</span>
      </div>

      <p className={styles.reasoning}>{record.reasoning}</p>

      <div className={styles.footer}>
        <span className={styles.timestamp}>{formattedDate}</span>
        <span className={`${styles.confidence} ${confidenceClass}`}>
          {confidencePercent}% confidence
        </span>
      </div>
    </div>
  );
}
