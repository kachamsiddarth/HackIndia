"use client";

import { type ReactNode } from "react";
import styles from "./TrustScore.module.css";

export interface TrustScoreProps {
  score: number; // 0 - 100
  riskLevel?: "LOW" | "MEDIUM" | "HIGH";
}

/**
 * TrustScore renders AI fix confidence score and risk classification.
 */
export default function TrustScore({ score, riskLevel = "LOW" }: TrustScoreProps): ReactNode {
  const scoreClass =
    score >= 85 ? styles.high : score >= 65 ? styles.medium : styles.low;

  return (
    <div className={styles.container}>
      <span className={`${styles.scoreBadge} ${scoreClass}`}>{score}%</span>
      <div className={styles.details}>
        <span className={styles.title}>Trust Score</span>
        <span className={styles.subtitle}>{riskLevel} Risk</span>
      </div>
    </div>
  );
}
