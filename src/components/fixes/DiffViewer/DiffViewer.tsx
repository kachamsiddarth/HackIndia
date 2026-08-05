"use client";

import { type ReactNode } from "react";
import styles from "./DiffViewer.module.css";

export interface DiffViewerProps {
  patch: string;
  filename?: string;
}

/**
 * DiffViewer renders unified git diff patches with syntax highlights for added and removed lines.
 */
export default function DiffViewer({ patch, filename }: DiffViewerProps): ReactNode {
  const lines = patch.split("\n");

  return (
    <div className={styles.container}>
      {filename && (
        <div className={styles.header}>
          <span className={styles.filename}>{filename}</span>
        </div>
      )}
      <pre className={styles.diffContent}>
        {lines.map((line, index) => {
          let lineClass = styles.normal;
          if (line.startsWith("+") && !line.startsWith("+++")) {
            lineClass = styles.added;
          } else if (line.startsWith("-") && !line.startsWith("---")) {
            lineClass = styles.removed;
          } else if (line.startsWith("@@") || line.startsWith("diff")) {
            lineClass = styles.headerLine;
          }

          return (
            <span key={index} className={`${styles.line} ${lineClass}`}>
              {line}
            </span>
          );
        })}
      </pre>
    </div>
  );
}
