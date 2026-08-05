"use client";

import { type ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import type { PipelineIssue, PipelineFix } from "@/components/pipeline/PipelineView";
import styles from "./IssueCard.module.css";

export interface IssueCardProps {
  issue: PipelineIssue & {
    title?: string;
    description?: string;
    codeSnippet?: string;
    wcagRuleName?: string;
    wcagLevel?: string;
    projectName?: string;
  };
  fix?: PipelineFix | null;
  onSelect?: (issue: PipelineIssue) => void;
}

function severityVariant(severity: string): "critical" | "error" | "warning" | "info" {
  switch (severity.toLowerCase()) {
    case "critical":
      return "critical";
    case "serious":
    case "major":
    case "error":
      return "error";
    case "moderate":
    case "minor":
    case "warning":
      return "warning";
    default:
      return "info";
  }
}

/**
 * IssueCard renders an accessibility issue regression item with severity, WCAG details,
 * file path location, code snippet preview, and fix state.
 */
export default function IssueCard({
  issue,
  fix,
  onSelect,
}: IssueCardProps): ReactNode {
  const location = `${issue.filePath}${issue.lineNumber ? `:${issue.lineNumber}` : ""}`;

  return (
    <div
      className={styles.card}
      onClick={() => onSelect?.(issue)}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={(e) => {
        if (onSelect && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onSelect(issue);
        }
      }}
    >
      <div className={styles.header}>
        <div>
          <h3 className={styles.message}>{issue.title ?? issue.message}</h3>
          <div className={styles.meta}>
            <span className={styles.filePath}>{location}</span>
            <span className={styles.wcagTag}>
              {issue.wcagCriteria ?? issue.ruleId} {issue.wcagLevel ? `(${issue.wcagLevel})` : ""}
            </span>
            {issue.projectName && (
              <span style={{ color: "var(--color-text-tertiary)" }}>• {issue.projectName}</span>
            )}
          </div>
        </div>

        <Badge variant={severityVariant(issue.severity)} size="sm">
          {issue.severity}
        </Badge>
      </div>

      {issue.codeSnippet && (
        <pre className={styles.snippet}>{issue.codeSnippet}</pre>
      )}

      <div className={styles.footer}>
        <div className={styles.fixStatus}>
          {fix ? (
            <Badge variant={fix.status === "verified" ? "success" : "neutral"} size="sm" showDot>
              Fix: {fix.status}
            </Badge>
          ) : (
            <span style={{ color: "var(--color-text-tertiary)" }}>No automated fix</span>
          )}
        </div>

        <span className={styles.viewBtn}>
          View Details
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </span>
      </div>
    </div>
  );
}
