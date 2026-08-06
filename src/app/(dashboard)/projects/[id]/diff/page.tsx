"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { DiffViewer } from "@/components/fixes/DiffViewer";
import { FixActions } from "@/components/fixes/FixActions";
import { Card, Skeleton } from "@/components/ui";
import styles from "./page.module.css";

interface DiffPageProps {
  params: Promise<{ id: string }>;
}

interface FixDiffItem {
  id: string;
  filePath: string;
  beforeCode: string;
  afterCode: string;
  diffPatch: string;
  reasoning: string;
  trustScore: number;
  status: string;
  issueMessage: string;
}

interface IssueSummary { id: string; message: string; filePath: string; }

export default function CodeDiffPage(props: DiffPageProps) {
  const { id: projectId } = use(props.params);

  const [fixes, setFixes] = useState<FixDiffItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    async function loadFixes() {
      try {
        setLoading(true);
        const res = await fetch(`/api/issues?projectId=${projectId}`);
        const json = await res.json();

        if (json.data?.fixes && json.data?.issues) {
          const issuesById = new Map<string, IssueSummary>(json.data.issues.map((issue: IssueSummary) => [issue.id, issue]));
          const list = json.data.fixes.map((fix: {
            id: string; issueId: string; status: string; diffPatch: string; rationale: string | null;
            beforeCode?: string; afterCode?: string; filePath?: string; trustScore?: number;
          }) => {
            const issue = issuesById.get(fix.issueId);
            return {
              id: fix.id,
              filePath: fix.filePath ?? issue?.filePath ?? "Changed file",
              beforeCode: fix.beforeCode ?? extractBeforeCode(fix.diffPatch),
              afterCode: fix.afterCode ?? extractAfterCode(fix.diffPatch),
              diffPatch: fix.diffPatch,
              reasoning: fix.rationale ?? "AI-generated accessibility remediation.",
              trustScore: fix.trustScore ?? 0,
              status: fix.status,
              issueMessage: issue?.message ?? "Accessibility regression",
            };
          });
          setFixes(list);
        }
      } catch (err) {
        console.error("Failed to load diffs:", err);
      } finally {
        setLoading(false);
      }
    }

    void loadFixes();
  }, [projectId]);

  const currentFix = fixes[selectedIndex];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Unified Code Diffs</h1>
        </div>
        <Link href={`/projects/${projectId}`} className={styles.backLink}>
          Back to project
        </Link>
      </div>

      {fixes.length > 0 && (
        <Card padding="md" className={styles.controls}>
          <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>Select File Diff:</label>
          <select
            className={styles.select}
            value={selectedIndex}
            onChange={(e) => setSelectedIndex(Number(e.target.value))}
          >
            {fixes.map((fix, idx) => (
              <option key={fix.id} value={idx}>
                {fix.filePath} (Trust Score: {fix.trustScore}%)
              </option>
            ))}
          </select>
        </Card>
      )}

      {loading ? (
        <Skeleton height={350} />
      ) : currentFix ? (
        <section className={styles.diffWorkspace} aria-label="Code diff review workspace">
          <Card className={styles.issueSummary}>
            <div>
              <p className={styles.eyebrow}>Accessibility regression</p>
              <h2>{currentFix.issueMessage}</h2>
              <p>{currentFix.reasoning}</p>
            </div>
            <FixActions fixId={currentFix.id} initialStatus={currentFix.status} />
          </Card>
          <DiffViewer filename={currentFix.filePath} patch={currentFix.diffPatch} />
          <div className={styles.previews}>
            <CodePreview label="Before: changed code" code={currentFix.beforeCode} variant="before" />
            <CodePreview label="After: recommended AI fix" code={currentFix.afterCode} variant="after" />
          </div>
        </section>
      ) : (
        <Card padding="lg" style={{ textAlign: "center", color: "var(--color-text-secondary)" }}>
          <h3>No Code Diffs Available</h3>
          <p>Run an AccessDiff pipeline to generate AI accessibility patches and diffs.</p>
        </Card>
      )}
    </div>
  );
}

function extractBeforeCode(patch: string): string {
  return patch.split("\n").filter((line) => line.startsWith("-") && !line.startsWith("---")).map((line) => line.slice(1)).join("\n");
}

function extractAfterCode(patch: string): string {
  return patch.split("\n").filter((line) => line.startsWith("+") && !line.startsWith("+++")).map((line) => line.slice(1)).join("\n");
}

function CodePreview({ label, code, variant }: { label: string; code: string; variant: "before" | "after" }) {
  return (
    <Card className={styles.previewCard}>
      <h3>{label}</h3>
      <pre className={variant === "before" ? styles.beforeCode : styles.afterCode}><code>{code || "No renderable snippet was returned."}</code></pre>
    </Card>
  );
}
