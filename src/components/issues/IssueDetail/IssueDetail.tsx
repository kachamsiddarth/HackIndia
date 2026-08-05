"use client";

import { useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { DiffViewer, TrustScore, FixActions, VerificationStatusIndicator } from "@/components/fixes";
import type { PipelineIssue, PipelineFix } from "@/components/pipeline/PipelineView";
import styles from "./IssueDetail.module.css";

export interface ExtendedIssue extends PipelineIssue {
  title?: string;
  description?: string;
  codeSnippet?: string;
  wcagRuleName?: string;
  wcagLevel?: string;
  projectName?: string;
}

export interface IssueDetailProps {
  issue: ExtendedIssue | null;
  fix?: PipelineFix | null;
  isOpen: boolean;
  onClose: () => void;
}

function getWcagUrl(ruleId: string): string {
  return `https://www.w3.org/WAI/WCAG22/quickref/#${ruleId}`;
}

/**
 * Modal detail view for inspecting an accessibility regression issue and approving/rejecting its AI-generated fix.
 */
export default function IssueDetail({
  issue,
  fix,
  isOpen,
  onClose,
}: IssueDetailProps): ReactNode {
  const [fixStatus, setFixStatus] = useState<string | null>(fix?.status ?? null);

  if (!issue) return null;

  const location = `${issue.filePath}${issue.lineNumber ? `:${issue.lineNumber}` : ""}`;
  const ruleTag = issue.wcagCriteria ?? issue.ruleId;
  const currentFixStatus = fixStatus ?? fix?.status ?? "pending";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={issue.title ?? issue.message}
      size="lg"
    >
      <div className={styles.content}>
        <div className={styles.metaGrid}>
          <div className={styles.metaCard}>
            <span className={styles.metaLabel}>File Location</span>
            <span className={styles.metaValue}>{location}</span>
          </div>

          <div className={styles.metaCard}>
            <span className={styles.metaLabel}>WCAG Rule</span>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.1rem" }}>
              <Badge variant="info" size="sm">{ruleTag}</Badge>
              <a
                href={getWcagUrl(ruleTag)}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.wcagLink}
              >
                Docs ↗
              </a>
            </div>
          </div>
        </div>

        {issue.description && (
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Description & Impact</h4>
            <p className={styles.description}>{issue.description}</p>
          </div>
        )}

        {issue.codeSnippet && (
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Detected Code Context</h4>
            <pre className={styles.codeBlock}>{issue.codeSnippet}</pre>
          </div>
        )}

        {fix ? (
          <div className={styles.section}>
            <div className={styles.fixHeader}>
              <h4 className={styles.sectionTitle}>AI Generated Remediation Fix</h4>
              <VerificationStatusIndicator status={currentFixStatus} />
            </div>

            {fix.rationale && (
              <p className={styles.description} style={{ fontStyle: "italic" }}>
                &quot;{fix.rationale}&quot;
              </p>
            )}

            <div style={{ margin: "0.75rem 0" }}>
              <TrustScore score={currentFixStatus === "approved" || currentFixStatus === "verified" ? 95 : 78} riskLevel="LOW" />
            </div>

            <DiffViewer patch={fix.diffPatch} filename={issue.filePath} />

            <div style={{ marginTop: "1rem" }}>
              <FixActions
                fixId={fix.id}
                initialStatus={currentFixStatus}
                onStatusChange={(newStatus) => setFixStatus(newStatus)}
              />
            </div>
          </div>
        ) : (
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Remediation</h4>
            <p className={styles.description} style={{ color: "var(--color-text-tertiary)" }}>
              No automated fix has been verified for this regression yet. Run AccessDiff pipeline to generate AI fixes.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
