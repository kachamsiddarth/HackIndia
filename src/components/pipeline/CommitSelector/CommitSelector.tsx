"use client";

import { type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import styles from "./CommitSelector.module.css";

export interface CommitOption {
  sha: string;
  commit: {
    message: string;
    author: { date: string };
  };
}

export interface CommitSelectorProps {
  commits: CommitOption[];
  baseCommit: string;
  headCommit: string;
  onBaseChange: (sha: string) => void;
  onHeadChange: (sha: string) => void;
  onStartPipeline?: () => void;
  isStarting?: boolean;
}

function formatSha(sha: string): string {
  return sha.slice(0, 7);
}

/**
 * CommitSelector UI for choosing Base and Head commits for regression analysis.
 */
export default function CommitSelector({
  commits,
  baseCommit,
  headCommit,
  onBaseChange,
  onHeadChange,
  onStartPipeline,
  isStarting = false,
}: CommitSelectorProps): ReactNode {
  const selectedBase = commits.find((c) => c.sha === baseCommit);
  const selectedHead = commits.find((c) => c.sha === headCommit);
  const isValidSelection = Boolean(baseCommit && headCommit && baseCommit !== headCommit);

  return (
    <div className={styles.container}>
      <div>
        <h2 className={styles.title}>Regression Analysis Commit Selector</h2>
        <p className={styles.description}>
          Select a previous commit (Base) and a target commit (Head) to run AccessDiff automated accessibility verification.
        </p>
      </div>

      <div className={styles.grid}>
        <div className={styles.selectGroup}>
          <label className={styles.label} htmlFor="base-commit-select">
            Base Commit (Previous)
          </label>
          <select
            id="base-commit-select"
            className={styles.select}
            value={baseCommit}
            onChange={(e) => onBaseChange(e.target.value)}
          >
            <option value="">Select Base Commit...</option>
            {commits.map((c) => (
              <option key={`base-${c.sha}`} value={c.sha}>
                {formatSha(c.sha)} — {c.commit.message.slice(0, 45)}
              </option>
            ))}
          </select>

          {selectedBase && (
            <div className={styles.preview}>
              <span className={styles.shaBadge}>{formatSha(selectedBase.sha)}</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {selectedBase.commit.message}
              </span>
            </div>
          )}
        </div>

        <div className={styles.selectGroup}>
          <label className={styles.label} htmlFor="head-commit-select">
            Head Commit (New Changes)
          </label>
          <select
            id="head-commit-select"
            className={styles.select}
            value={headCommit}
            onChange={(e) => onHeadChange(e.target.value)}
          >
            <option value="">Select Head Commit...</option>
            {commits.map((c) => (
              <option key={`head-${c.sha}`} value={c.sha}>
                {formatSha(c.sha)} — {c.commit.message.slice(0, 45)}
              </option>
            ))}
          </select>

          {selectedHead && (
            <div className={styles.preview}>
              <span className={styles.shaBadge}>{formatSha(selectedHead.sha)}</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {selectedHead.commit.message}
              </span>
            </div>
          )}
        </div>
      </div>

      {onStartPipeline && (
        <div className={styles.actions}>
          <Button
            variant="primary"
            disabled={!isValidSelection || isStarting}
            isLoading={isStarting}
            onClick={onStartPipeline}
            leftIcon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            }
          >
            {baseCommit === headCommit && baseCommit !== ""
              ? "Select Two Different Commits"
              : "Run AccessDiff Analysis"}
          </Button>
        </div>
      )}
    </div>
  );
}
