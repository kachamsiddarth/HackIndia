"use client";

import { type ReactNode } from "react";
import type { GovernanceRecord } from "../GovernanceLogCard";
import styles from "./GovernanceTimeline.module.css";

export interface GovernanceTimelineProps {
  records: GovernanceRecord[];
}

/**
 * Vertical timeline visualization of AI governance audit trail entries.
 */
export default function GovernanceTimeline({
  records,
}: GovernanceTimelineProps): ReactNode {
  if (records.length === 0) {
    return (
      <p style={{ color: "var(--color-text-tertiary)", textAlign: "center", padding: "2rem" }}>
        No governance records to display.
      </p>
    );
  }

  return (
    <div className={styles.timeline} role="list" aria-label="Governance audit timeline">
      {records.map((record) => {
        const isFailed = record.action.toLowerCase().includes("failed") || record.action.toLowerCase().includes("rejected");
        const isCompleted = record.action.toLowerCase().includes("completed") || record.action.toLowerCase().includes("approved");

        const dotClass = [
          styles.dot,
          isFailed ? styles.failed : isCompleted ? styles.completed : "",
        ]
          .filter(Boolean)
          .join(" ");

        const formattedTime = new Date(record.createdAt).toLocaleString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });

        return (
          <div key={record.id} className={styles.entry} role="listitem">
            <span className={dotClass} aria-hidden="true" />
            <div className={styles.entryHeader}>
              <span className={styles.agentTag}>{record.agentName}</span>
              <span className={styles.actionTag}>{record.action}</span>
              <span className={styles.time}>{formattedTime}</span>
            </div>
            <p className={styles.reasoning}>{record.reasoning}</p>
          </div>
        );
      })}
    </div>
  );
}
