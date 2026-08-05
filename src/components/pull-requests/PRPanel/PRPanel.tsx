"use client";

import { type ReactNode, useEffect, useState } from "react";
import { Button } from "@/components/ui";
import styles from "./PRPanel.module.css";

export interface PRRecord {
  id: string;
  pipelineRunId: string;
  projectId: string;
  prNumber: number;
  prUrl: string;
  title: string;
  status: string;
  filesModified: number;
  issuesAddressed: number;
  scoreImprovement: number | null;
  createdAt: string;
}

export interface PRPanelProps {
  projectId: string;
  pipelineRunId?: string;
}

export default function PRPanel({ projectId, pipelineRunId }: PRPanelProps): ReactNode {
  const [pullRequests, setPullRequests] = useState<PRRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("AccessDiff: Accessibility Fixes");
  const [successUrl, setSuccessUrl] = useState<string | null>(null);

  useEffect(() => {
    async function loadPRs() {
      try {
        setLoading(true);
        const res = await fetch(`/api/pull-requests?projectId=${projectId}`);
        const json = await res.json();
        if (json.data?.pullRequests) {
          setPullRequests(json.data.pullRequests);
        }
      } catch (err) {
        console.error("Failed to load PRs:", err);
      } finally {
        setLoading(false);
      }
    }
    void loadPRs();
  }, [projectId]);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCreatePR = async (directCommit = false) => {
    if (!pipelineRunId) return;
    setErrorMessage(null);
    setSuccessUrl(null);
    try {
      setCreating(true);
      const res = await fetch("/api/pull-requests/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, pipelineRunId, title, directCommit }),
      });
      const json = await res.json();
      if (json.data) {
        setSuccessUrl(json.data.prUrl);
        setPullRequests((prev) => [
          {
            id: json.data.id ?? "",
            pipelineRunId: pipelineRunId,
            projectId,
            prNumber: json.data.prNumber,
            prUrl: json.data.prUrl,
            title: directCommit ? `${title} (Direct Commit)` : title,
            status: json.data.status,
            filesModified: json.data.filesModified,
            issuesAddressed: json.data.issuesAddressed,
            scoreImprovement: null,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
        setShowForm(false);
      } else if (json.error?.message) {
        setErrorMessage(json.error.message);
      }
    } catch (err) {
      console.error("Failed to create PR:", err);
      setErrorMessage("Failed to create pull request. Check console for details.");
    } finally {
      setCreating(false);
    }
  };

  const statusClass = (status: string) => {
    if (status === "merged") return styles.prMerged;
    if (status === "closed") return styles.prClosed;
    return styles.prOpen;
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Pull Requests</span>
        {pipelineRunId && !showForm && (
          <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>
            + Create PR
          </Button>
        )}
      </div>

      {successUrl && (
        <div className={styles.successBanner}>
          ✅ PR created successfully!{" "}
          <a href={successUrl} target="_blank" rel="noopener noreferrer" className={styles.prLink}>
            View on GitHub →
          </a>
        </div>
      )}

      {showForm && (
        <div className={styles.form}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>PR Title</label>
            <input
              className={styles.input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="AccessDiff: Accessibility Fixes"
            />
          </div>
          {errorMessage && (
            <p style={{ color: "#f87171", fontSize: "0.8rem", margin: "0 0 0.5rem 0" }}>
              ⚠️ {errorMessage}
            </p>
          )}

          <div className={styles.actions}>
            <Button variant="secondary" size="sm" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button variant="secondary" size="sm" isLoading={creating} onClick={() => handleCreatePR(true)}>
              Direct Commit to Main
            </Button>
            <Button variant="primary" size="sm" isLoading={creating} onClick={() => handleCreatePR(false)}>
              Create Pull Request
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: "var(--color-text-tertiary)", fontSize: "0.85rem" }}>Loading PRs…</p>
      ) : pullRequests.length > 0 ? (
        <div className={styles.prList}>
          {pullRequests.map((pr) => (
            <a
              key={pr.id || pr.prNumber}
              href={pr.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.prItem}
            >
              <div className={styles.prMeta}>
                <span className={styles.prNumber}>#{pr.prNumber}</span>
                <span className={styles.prTitle}>{pr.title}</span>
              </div>
              <span className={`${styles.prBadge} ${statusClass(pr.status)}`}>
                {pr.status}
              </span>
            </a>
          ))}
        </div>
      ) : (
        <p style={{ color: "var(--color-text-tertiary)", fontSize: "0.85rem" }}>
          No pull requests yet. Run a pipeline and create one from the results.
        </p>
      )}
    </div>
  );
}
