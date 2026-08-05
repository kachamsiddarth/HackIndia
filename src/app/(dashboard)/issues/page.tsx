"use client";

import { useEffect, useState } from "react";
import { Card, Input, Skeleton } from "@/components/ui";
import { IssueCard, IssueDetail } from "@/components/issues";
import type { PipelineFix } from "@/components/pipeline";
import styles from "./page.module.css";

interface IssueItem {
  id: string;
  ruleId: string;
  wcagCriteria: string | null;
  wcagRuleName?: string;
  wcagLevel?: string;
  severity: "critical" | "serious" | "moderate" | "minor";
  message: string;
  title?: string;
  description?: string;
  filePath: string;
  lineNumber: number | null;
  codeSnippet?: string;
  projectId: string;
  projectName?: string;
  pipelineRunId: string;
  createdAt: string;
}

interface ProjectOption {
  id: string;
  name: string;
}

export default function IssuesPage() {
  const [issues, setIssues] = useState<IssueItem[]>([]);
  const [fixes, setFixes] = useState<PipelineFix[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedSeverity, setSelectedSeverity] = useState("all");
  const [selectedProject, setSelectedProject] = useState("all");

  // Selected issue for detail modal
  const [activeIssue, setActiveIssue] = useState<IssueItem | null>(null);

  useEffect(() => {
    async function loadIssues() {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (selectedSeverity !== "all") params.set("severity", selectedSeverity);
        if (selectedProject !== "all") params.set("projectId", selectedProject);

        const res = await fetch(`/api/issues?${params.toString()}`);
        const json = await res.json();

        if (json.data) {
          setIssues(json.data.issues || []);
          setFixes(json.data.fixes || []);
          if (json.data.projects) setProjects(json.data.projects);
        }
      } catch (err) {
        console.error("Failed to fetch issues:", err);
      } finally {
        setLoading(false);
      }
    }

    const timer = setTimeout(() => {
      void loadIssues();
    }, 200);

    return () => clearTimeout(timer);
  }, [search, selectedSeverity, selectedProject]);

  const activeFix = activeIssue
    ? fixes.find((f) => f.issueId === activeIssue.id)
    : null;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Accessibility Regressions</p>
          <h1 className={styles.title}>All Issues</h1>
          <p className={styles.description}>
            View, filter, and inspect WCAG 2.2 accessibility regressions isolated by AccessDiff across your repositories.
          </p>
        </div>
      </div>

      <Card className={styles.controlsCard} padding="md">
        <div className={styles.searchGroup}>
          <Input
            label="Search Issues"
            hideLabel
            placeholder="Search by issue title, WCAG rule, or file path..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className={styles.filterGroup}>
          <select
            className={styles.select}
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            aria-label="Filter by severity"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="serious">Serious</option>
            <option value="moderate">Moderate</option>
            <option value="minor">Minor</option>
          </select>

          <select
            className={styles.select}
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            aria-label="Filter by project"
          >
            <option value="all">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {loading ? (
        <div className={styles.issuesGrid}>
          <Skeleton height={140} />
          <Skeleton height={140} />
          <Skeleton height={140} />
        </div>
      ) : issues.length > 0 ? (
        <div className={styles.issuesGrid}>
          {issues.map((issue) => {
            const fix = fixes.find((f) => f.issueId === issue.id);
            return (
              <IssueCard
                key={issue.id}
                issue={issue}
                fix={fix}
                onSelect={(selected) => setActiveIssue(selected as IssueItem)}
              />
            );
          })}
        </div>
      ) : (
        <Card className={styles.emptyState}>
          <h3>No Accessibility Issues Found</h3>
          <p>
            {search || selectedSeverity !== "all" || selectedProject !== "all"
              ? "No issues match your current filter criteria."
              : "Great job! Run an AccessDiff pipeline on your project to detect regressions."}
          </p>
        </Card>
      )}

      {/* Issue Detail Modal */}
      <IssueDetail
        issue={activeIssue}
        fix={activeFix}
        isOpen={Boolean(activeIssue)}
        onClose={() => setActiveIssue(null)}
      />
    </div>
  );
}
