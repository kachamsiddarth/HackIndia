"use client";

import { type ReactNode } from "react";
import styles from "./CodeBlock.module.css";

export interface CodeIssueAnnotation {
  id: string;
  lineNumber?: number | null;
  severity: string;
  title: string;
  description: string;
  wcagRule: string;
}

export interface CodeBlockProps {
  filePath: string;
  content: string;
  issues?: CodeIssueAnnotation[];
}

/**
 * Renders file code content with line numbers and inline accessibility violation callouts.
 */
export default function CodeBlock({
  filePath,
  content,
  issues = [],
}: CodeBlockProps): ReactNode {
  const lines = content.split("\n");

  const issuesByLine = new Map<number, CodeIssueAnnotation[]>();
  for (const issue of issues) {
    if (issue.lineNumber) {
      const list = issuesByLine.get(issue.lineNumber) ?? [];
      list.push(issue);
      issuesByLine.set(issue.lineNumber, list);
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.filePath}>{filePath}</span>
        <span>{lines.length} lines</span>
      </div>

      <div className={styles.codeArea}>
        {lines.map((lineText, idx) => {
          const lineNum = idx + 1;
          const lineIssues = issuesByLine.get(lineNum);
          const hasIssue = Boolean(lineIssues && lineIssues.length > 0);

          return (
            <div key={lineNum} className={styles.lineRow}>
              <div className={`${styles.lineContent} ${hasIssue ? styles.hasIssue : ""}`}>
                <span className={styles.lineNumber}>{lineNum}</span>
                <span className={styles.lineText}>{lineText || " "}</span>
              </div>

              {lineIssues?.map((issue) => (
                <div key={issue.id} className={styles.annotation}>
                  <div className={styles.annotationHeader}>
                    <span className={styles.ruleBadge}>WCAG {issue.wcagRule}</span>
                    <span>{issue.title}</span>
                  </div>
                  <div>{issue.description}</div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
