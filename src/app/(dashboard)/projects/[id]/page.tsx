"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Badge, Skeleton } from "@/components/ui";
import { CommitSelector } from "@/components/pipeline";
import styles from "./page.module.css";

interface RiskArea {
  component: string;
  filePath: string;
  riskLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  reason: string;
}

interface Commit {
  sha: string;
  commit: {
    message: string;
    author: { date: string };
  };
}

interface ProjectDetail {
  id: string;
  name: string;
  github_repo: string;
  framework: string;
  default_branch: string;
  accessibility_score: number;
  ai_summary: string;
  risk_areas: RiskArea[];
  commits?: Commit[];
}

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [baseCommit, setBaseCommit] = useState("");
  const [headCommit, setHeadCommit] = useState("");
  const [isStartingPipeline, setIsStartingPipeline] = useState(false);

  useEffect(() => {
    async function loadProject() {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/projects/${id}`);
        const json = await res.json();
        if (json.data) {
          setProject(json.data);
          if (json.data.commits && json.data.commits.length >= 2) {
            setBaseCommit(json.data.commits[1].sha);
            setHeadCommit(json.data.commits[0].sha);
          }
        }
      } catch (err) {
        console.error("Failed to load project details:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadProject();
  }, [id]);

  const handleStartPipeline = () => {
    setIsStartingPipeline(true);
    // Navigate to pipeline page with query parameters
    const query = new URLSearchParams({
      projectId: id,
      base: baseCommit,
      head: headCommit,
    }).toString();
    router.push(`/pipeline?${query}`);
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <Skeleton height={40} width="50%" />
        <Skeleton height={200} style={{ marginTop: 24 }} />
      </div>
    );
  }

  if (!project) {
    return (
      <div className={styles.container}>
        <h2>Project Not Found</h2>
        <Button variant="secondary" onClick={() => router.push("/projects")}>
          Back to Projects
        </Button>
      </div>
    );
  }

  const commitsList = project.commits || [];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>
            {project.name}
            <Badge variant="neutral" size="md">
              {project.framework || "Web App"}
            </Badge>
          </h1>
          <div className={styles.badgeGroup}>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>
              GitHub Repo: <strong>{project.github_repo}</strong>
            </span>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-tertiary)" }}>
              • Branch: {project.default_branch}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => router.push(`/projects/${id}/explorer`)}
            leftIcon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            }
          >
            Explore Codebase
          </Button>

          <Button
            variant="secondary"
            size="lg"
            onClick={() => router.push(`/projects/${id}/timeline`)}
            leftIcon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            }
          >
            Timeline & PRs
          </Button>

          <Button
            variant="secondary"
            size="lg"
            onClick={() => router.push(`/projects/${id}/diff`)}
            leftIcon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 3h5v5" />
                <path d="M8 21H3v-5" />
                <path d="M21 3l-7.5 7.5" />
                <path d="M3 21l7.5-7.5" />
              </svg>
            }
          >
            Code Diffs
          </Button>

          <Button
            variant="primary"
            size="lg"
            isLoading={isStartingPipeline}
            onClick={handleStartPipeline}
            leftIcon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            }
          >
            Run AccessDiff Pipeline
          </Button>
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.leftColumn}>
          {/* Commit Diff Comparison Launcher */}
          <Card padding="lg" className={styles.commitSelectorCard}>
            <CommitSelector
              commits={commitsList}
              baseCommit={baseCommit}
              headCommit={headCommit}
              onBaseChange={setBaseCommit}
              onHeadChange={setHeadCommit}
              onStartPipeline={handleStartPipeline}
              isStarting={isStartingPipeline}
            />
          </Card>

          {/* Repository Risk Areas */}
          <Card padding="lg">
            <h2 className={styles.sectionTitle}>AI Accessibility Risk Assessment</h2>
            {project.risk_areas && project.risk_areas.length > 0 ? (
              <div className={styles.riskList}>
                {project.risk_areas.map((risk, idx) => (
                  <div
                    key={idx}
                    className={styles.riskItem}
                    style={{ cursor: "pointer" }}
                    onClick={() => router.push(`/projects/${id}/explorer`)}
                    title="Click to view file in Codebase Explorer"
                  >
                    <div className={styles.riskInfo}>
                      <span className={styles.riskComponent}>{risk.component}</span>
                      <span className={styles.riskPath}>📂 {risk.filePath}</span>
                      <span className={styles.riskReason}>{risk.reason}</span>
                    </div>
                    <Badge
                      variant={
                        risk.riskLevel === "CRITICAL"
                          ? "critical"
                          : risk.riskLevel === "HIGH"
                          ? "warning"
                          : "info"
                      }
                      size="sm"
                    >
                      {risk.riskLevel} RISK
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: "var(--color-text-tertiary)", fontSize: "var(--text-sm)" }}>
                No high-risk UI components flagged during initial analysis.
              </p>
            )}
          </Card>
        </div>

        <div className={styles.rightColumn}>
          <Card padding="md">
            <h3 style={{ fontSize: "var(--text-sm)", color: "var(--color-text-tertiary)", textTransform: "uppercase" }}>
              Accessibility Rating
            </h3>
            <div style={{ fontSize: "3rem", fontWeight: "bold", fontFamily: "var(--font-mono)", color: "var(--color-accent)", margin: "0.5rem 0" }}>
              {project.accessibility_score}%
            </div>
            <Badge variant="success" size="sm" showDot>
              WCAG 2.2 AA Verified
            </Badge>
          </Card>

          <Card padding="md">
            <h3 className={styles.sectionTitle}>AI Architecture Summary</h3>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", lineHeight: "var(--leading-relaxed)" }}>
              {project.ai_summary}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
