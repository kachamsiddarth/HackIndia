"use client";

import { type ReactNode } from "react";
import styles from "./ScoreGauge.module.css";

export interface ScoreGaugeProps {
  score: number;
  label?: string;
}

export default function ScoreGauge({
  score,
  label = "WCAG Compliance Score",
}: ScoreGaugeProps): ReactNode {
  const normalizedScore = Math.max(0, Math.min(100, score));
  const radius = 54;
  const circumference = 2 * Math.PI * radius; // ~339.292
  const strokeDashoffset = circumference - (normalizedScore / 100) * circumference;

  return (
    <div className={styles.container}>
      <div className={styles.gaugeRing}>
        <svg className={styles.svg} width="140" height="140" viewBox="0 0 120 120">
          <circle className={styles.bgCircle} cx="60" cy="60" r={radius} />
          <circle
            className={styles.scoreCircle}
            cx="60"
            cy="60"
            r={radius}
            style={{
              strokeDasharray: circumference,
              strokeDashoffset,
            }}
          />
        </svg>
        <span className={styles.valueText}>{normalizedScore}%</span>
      </div>
      <span className={styles.label}>{label}</span>
    </div>
  );
}
