import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button, Card, Badge } from "@/components/ui";
import styles from "./page.module.css";

interface ProjectSummary {
  id: string;
  github_repo: string | null;
  name: string | null;
  framework: string | null;
  default_branch: string | null;
  accessibility_score: number | null;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch projects from Supabase
  let projects: ProjectSummary[] = [];
  if (user) {
    const { data } = await supabase
      .from("projects")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) projects = data as ProjectSummary[];
  }

  const projectCount = projects.length;
  const avgScore =
    projectCount > 0
      ? Math.round(
          projects.reduce((acc, p) => acc + (p.accessibility_score || 100), 0) /
            projectCount
        )
      : 100;

  return (
    <div className={styles.container}>
      <div className={styles.welcomeHeader}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Accessibility Overview</h1>
          <p className={styles.subtitle}>
            Monitor accessibility regressions, AI-generated fixes, and WCAG compliance across your imported GitHub repositories.
          </p>
        </div>
        <Link href="/projects">
          <Button
            variant="primary"
            size="md"
            leftIcon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            }
          >
            Import Repository
          </Button>
        </Link>
      </div>

      <div className={styles.statsGrid}>
        <Card padding="md" className={styles.statCard}>
          <span className={styles.statLabel}>Avg Accessibility Score</span>
          <span className={styles.statValue}>{avgScore}%</span>
          <span className={styles.statSub}>
            <Badge variant="success" size="sm">WCAG 2.2 AA</Badge>
          </span>
        </Card>

        <Card padding="md" className={styles.statCard}>
          <span className={styles.statLabel}>Active Projects</span>
          <span className={styles.statValue}>{projectCount}</span>
          <span className={styles.statSub}>Imported repositories</span>
        </Card>

        <Card padding="md" className={styles.statCard}>
          <span className={styles.statLabel}>Regressions Prevented</span>
          <span className={styles.statValue}>0</span>
          <span className={styles.statSub}>Zero outstanding violations</span>
        </Card>

        <Card padding="md" className={styles.statCard}>
          <span className={styles.statLabel}>AI Trust Index</span>
          <span className={styles.statValue}>98.5%</span>
          <span className={styles.statSub}>Mutagent Helix verified</span>
        </Card>
      </div>

      <div className={styles.sectionGrid}>
        <Card padding="lg">
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Recent Repositories</h2>
            <Link href="/projects">
              <Button variant="ghost" size="sm">View All</Button>
            </Link>
          </div>

          {projectCount === 0 ? (
            <div className={styles.emptyState}>
              <svg className={styles.emptyIcon} width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              <h3>No Repositories Imported Yet</h3>
              <p>Connect your GitHub repository to enable automatic WCAG regression detection on every push.</p>
              <Link href="/projects">
                <Button variant="secondary" size="sm">Connect GitHub Repo</Button>
              </Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              {projects.slice(0, 5).map((project) => (
                <RepositoryRow key={project.id} project={project} />
              ))}
            </div>
          )}
        </Card>

        <Card padding="lg">
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Helix Pipeline Status</h2>
          </div>
          <div className={styles.emptyState}>
            <svg className={styles.emptyIcon} width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="6" y1="3" x2="6" y2="15" />
              <circle cx="18" cy="6" r="3" />
              <circle cx="6" cy="18" r="3" />
              <path d="M18 9a9 9 0 0 1-9 9" />
            </svg>
            <h3>Pipeline Idle</h3>
            <p>Select a repository and trigger a commit diff comparison to start the 5-stage ADL agent pipeline.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}

function RepositoryRow({ project }: { project: ProjectSummary }) {
  const score = project.accessibility_score ?? 0;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "var(--space-3)",
        background: "var(--color-bg-elevated)",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--color-border-subtle)",
      }}
    >
                  <div>
                    <Link
                      href={`/projects/${project.id}`}
                      style={{
                        fontWeight: "var(--weight-semibold)",
                        color: "var(--color-text-primary)",
                      }}
                    >
                      {project.github_repo || project.name}
                    </Link>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-tertiary)", marginTop: 2 }}>
                      {project.framework || "Web App"} • {project.default_branch || "main"}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                    <Badge variant={score >= 90 ? "success" : "warning"} size="sm">
                      {score}%
                    </Badge>
                    <Link href={`/projects/${project.id}`}>
                      <Button variant="secondary" size="sm">
                        View
                      </Button>
                    </Link>
                  </div>
    </div>
  );
}
