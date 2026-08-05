"use client";

import type { ReactNode } from "react";
import type { PipelineStatus } from "../PipelineView/PipelineView";
import styles from "./ProgressIndicator.module.css";

export interface ProgressStep {
  id: string;
  label: string;
  status: PipelineStatus;
}

export interface ProgressIndicatorProps {
  steps: ProgressStep[];
  currentStageId?: string | null;
}

const DEFAULT_HELIX_STAGES: Array<{ id: string; label: string }> = [
  { id: "spec", label: "Spec & Diff" },
  { id: "build", label: "A11y Analysis" },
  { id: "evaluate", label: "Verification" },
  { id: "diagnose", label: "Diagnosis" },
  { id: "optimize", label: "Optimization" },
];

/**
 * Visual ProgressIndicator displaying ADL pipeline steps with progress bar.
 */
export default function ProgressIndicator({
  steps,
  currentStageId,
}: ProgressIndicatorProps): ReactNode {
  const displaySteps = steps.length > 0
    ? steps
    : DEFAULT_HELIX_STAGES.map((stage) => {
        let status: PipelineStatus = "pending";
        if (currentStageId === stage.id) {
          status = "running";
        }
        return { ...stage, status };
      });

  const completedCount = displaySteps.filter((s) => s.status === "completed").length;
  const progressPercent = displaySteps.length > 0
    ? Math.round((completedCount / displaySteps.length) * 100)
    : 0;

  return (
    <div className={styles.container} role="region" aria-label="Pipeline progress">
      <div className={styles.barTrack}>
        <div
          className={styles.barFill}
          style={{ width: `${progressPercent}%` }}
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>

      <div className={styles.stepsGrid}>
        {displaySteps.map((step) => {
          const itemClass = [
            styles.stepItem,
            styles[step.status] ?? styles.pending,
          ].join(" ");

          return (
            <div key={step.id} className={itemClass}>
              <span className={styles.stepDot} aria-hidden="true" />
              <div className={styles.stepText}>
                <span className={styles.stepLabel}>{step.label}</span>
                <span className={styles.stepStatus}>{step.status}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
