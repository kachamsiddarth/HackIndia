"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { DiffViewer } from "@/components/fixes/DiffViewer";
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
}

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

        if (json.data?.issues) {
          const list: FixDiffItem[] = [];
          for (const iss of json.data.issues) {
            if (iss.fixes) {
              for (const f of iss.fixes) {
                list.push({
                  id: f.id,
                  filePath: f.filePath,
                  beforeCode: f.beforeCode,
                  afterCode: f.afterCode,
                  diffPatch: f.diffPatch,
                  reasoning: f.reasoning,
                  trustScore: f.trustScore,
                });
              }
            }
          }
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
        <DiffViewer
          filename={currentFix.filePath}
          patch={currentFix.diffPatch}
        />
      ) : (
        <Card padding="lg" style={{ textAlign: "center", color: "var(--color-text-secondary)" }}>
          <h3>No Code Diffs Available</h3>
          <p>Run an AccessDiff pipeline to generate AI accessibility patches and diffs.</p>
        </Card>
      )}
    </div>
  );
}
