"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, Badge, Modal, Input, Skeleton } from "@/components/ui";
import styles from "./page.module.css";

interface Project {
  id: string;
  name: string;
  github_repo: string;
  framework: string;
  accessibility_score: number;
  ai_summary: string;
  created_at: string;
}

interface GitHubRepo {
  id: number;
  full_name: string;
  description: string | null;
  language: string | null;
  default_branch: string;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [githubRepos, setGithubRepos] = useState<GitHubRepo[]>([]);
  const [isLoadingGithub, setIsLoadingGithub] = useState(false);
  const [importingRepo, setImportingRepo] = useState<string | null>(null);
  const [customRepoInput, setCustomRepoInput] = useState("");
  const [searchFilter, setSearchFilter] = useState("");

  const fetchProjects = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/projects");
      const json = await res.json();
      if (json.data) {
        setProjects(json.data);
      }
    } catch (err) {
      console.error("Failed to load projects:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchGithubRepos = async () => {
    try {
      setIsLoadingGithub(true);
      const res = await fetch("/api/github/repos");
      const json = await res.json();
      if (json.data) {
        setGithubRepos(json.data);
      }
    } catch (err) {
      console.error("Failed to load GitHub repos:", err);
    } finally {
      setIsLoadingGithub(false);
    }
  };

  useEffect(() => {
    const loadProjects = async (): Promise<void> => {
      await fetchProjects();
    };

    void loadProjects();
  }, []);

  const handleOpenModal = () => {
    setIsModalOpen(true);
    if (githubRepos.length === 0) {
      fetchGithubRepos();
    }
  };

  const handleImport = async (repoName: string) => {
    try {
      setImportingRepo(repoName);
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo_name: repoName }),
      });
      const json = await res.json();
      if (json.data) {
        setIsModalOpen(false);
        setCustomRepoInput("");
        await fetchProjects();
      } else if (json.error) {
        alert(`Import failed: ${json.error.message}`);
      }
    } catch (err) {
      console.error("Import error:", err);
    } finally {
      setImportingRepo(null);
    }
  };

  const filteredRepos = githubRepos.filter((r) =>
    r.full_name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Projects & Repositories</h1>
          <p className={styles.subtitle}>
            Import GitHub repositories to enable automated accessibility regression checks via Mutagent Helix.
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={handleOpenModal}
          leftIcon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          }
        >
          Import Repository
        </Button>
      </div>

      {isLoading ? (
        <div className={styles.grid}>
          {[1, 2, 3].map((i) => (
            <Card key={i} padding="md">
              <Skeleton height={24} width="60%" />
              <Skeleton height={16} width="40%" style={{ marginTop: 12 }} />
              <Skeleton height={60} style={{ marginTop: 16 }} />
            </Card>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <Card padding="lg" style={{ textAlign: "center", padding: "4rem 2rem" }}>
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="1.5"
            style={{ margin: "0 auto 1rem" }}
          >
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <h2 style={{ fontSize: "var(--text-xl)", marginBottom: "0.5rem" }}>No Projects Imported</h2>
          <p style={{ color: "var(--color-text-secondary)", marginBottom: "1.5rem" }}>
            Click the button below to connect a GitHub repository and run your first AI accessibility analysis.
          </p>
          <Button variant="primary" onClick={handleOpenModal}>
            Import First Repository
          </Button>
        </Card>
      ) : (
        <div className={styles.grid}>
          {projects.map((project) => (
            <Card key={project.id} padding="md" interactive className={styles.projectCard}>
              <div className={styles.cardTop}>
                <div>
                  <h3 className={styles.repoName}>
                    <Link href={`/projects/${project.id}`} className={styles.repoLink}>
                      {project.github_repo || project.name}
                    </Link>
                  </h3>
                  <div className={styles.cardMeta}>
                    <Badge variant="neutral" size="sm">
                      {project.framework || "Web App"}
                    </Badge>
                  </div>
                </div>
              </div>

              <p className={styles.summary}>{project.ai_summary}</p>

              <div className={styles.cardFooter}>
                <div className={styles.scoreGroup}>
                  <span className={styles.scoreValue}>{project.accessibility_score}%</span>
                  <Badge variant={project.accessibility_score >= 90 ? "success" : "warning"} size="sm">
                    Score
                  </Badge>
                </div>
                <Link href={`/projects/${project.id}`}>
                  <Button variant="secondary" size="sm">
                    Open Project
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Import Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Import GitHub Repository"
        size="lg"
      >
        <div className={styles.modalForm}>
          <Input
            label="Search Your GitHub Repositories"
            placeholder="Type repo name e.g. owner/repo..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            leftIcon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            }
          />

          <div className={styles.repoList}>
            {isLoadingGithub ? (
              <div style={{ padding: "1rem", textAlign: "center" }}>
                <Skeleton height={20} style={{ marginBottom: 8 }} />
                <Skeleton height={20} style={{ marginBottom: 8 }} />
                <Skeleton height={20} />
              </div>
            ) : filteredRepos.length > 0 ? (
              filteredRepos.map((repo) => (
                <div key={repo.id} className={styles.repoItem}>
                  <div className={styles.repoInfo}>
                    <span className={styles.repoTitle}>{repo.full_name}</span>
                    <span className={styles.repoSub}>
                      {repo.language || "HTML"} • Branch: {repo.default_branch}
                    </span>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    isLoading={importingRepo === repo.full_name}
                    onClick={() => handleImport(repo.full_name)}
                  >
                    Import & Analyze
                  </Button>
                </div>
              ))
            ) : (
              <div style={{ padding: "1rem", textAlign: "center", color: "var(--color-text-tertiary)" }}>
                No GitHub repositories found. You can enter a public repo manually below.
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <Input
                label="Or enter manual GitHub repository"
                placeholder="owner/repo (e.g. facebook/react)"
                value={customRepoInput}
                onChange={(e) => setCustomRepoInput(e.target.value)}
              />
            </div>
            <Button
              variant="secondary"
              size="md"
              disabled={!customRepoInput.includes("/")}
              isLoading={importingRepo === customRepoInput}
              onClick={() => handleImport(customRepoInput)}
            >
              Import
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
