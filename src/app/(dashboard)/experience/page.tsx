"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, Skeleton } from "@/components/ui";
import styles from "./page.module.css";

type ExperienceMode = "standard" | "screen-reader" | "keyboard" | "protanopia" | "deuteranopia" | "tritanopia" | "monochrome";

interface Project { id: string; name: string; github_repo: string; }
interface RepositoryFile { path: string; type: string; }

const MODES: Array<{ id: ExperienceMode; name: string; description: string }> = [
  { id: "standard", name: "Standard conditions", description: "Original repository preview without simulation." },
  { id: "screen-reader", name: "Screen reader simulation", description: "Shows the accessible elements detected in the imported file." },
  { id: "keyboard", name: "Keyboard navigation", description: "Highlights the imported preview and lists its tab-stop order." },
  { id: "protanopia", name: "Protanopia", description: "Applies a red-vision-deficiency simulation to the preview only." },
  { id: "deuteranopia", name: "Deuteranopia", description: "Applies a green-vision-deficiency simulation to the preview only." },
  { id: "tritanopia", name: "Tritanopia", description: "Applies a blue-vision-deficiency simulation to the preview only." },
  { id: "monochrome", name: "Monochrome", description: "Removes colour information from the preview only." },
];

export default function ExperienceModePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [filePath, setFilePath] = useState("");
  const [files, setFiles] = useState<RepositoryFile[]>([]);
  const [source, setSource] = useState("");
  const [mode, setMode] = useState<ExperienceMode>("standard");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/projects").then(async (response) => {
      const payload: unknown = await response.json();
      const data = isRecord(payload) && Array.isArray(payload.data) ? payload.data : [];
      const imported = data.flatMap((item): Project[] => isProject(item) ? [item] : []);
      setProjects(imported);
      if (imported[0]) setProjectId(imported[0].id);
      if (!imported.length) setError("Import a GitHub repository before opening Experience Mode.");
    }).catch(() => setError("Unable to load your imported repositories."));
  }, []);

  useEffect(() => {
    if (!projectId) return;
    void fetch(`/api/projects/${projectId}/files`).then(async (response) => {
      const payload: unknown = await response.json();
      const fileList = isRecord(payload) && isRecord(payload.data) && Array.isArray(payload.data.files) ? payload.data.files : [];
      const uiFiles = fileList.flatMap((item): RepositoryFile[] => isFile(item) && /\.(html|jsx|tsx|vue|svelte)$/i.test(item.path) ? [item] : []);
      setFiles(uiFiles);
      if (uiFiles[0]) setFilePath(uiFiles[0].path);
      else setError("This imported repository has no supported UI file to preview.");
    }).catch(() => setError("Unable to load repository files."));
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !filePath) return;
    void fetch(`/api/projects/${projectId}/files/content?path=${encodeURIComponent(filePath)}`).then(async (response) => {
      const payload: unknown = await response.json();
      if (!response.ok || !isRecord(payload) || !isRecord(payload.data) || typeof payload.data.content !== "string") {
        throw new Error("Unable to load the selected repository file.");
      }
      setError(null);
      setSource(payload.data.content);
    }).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Unable to load repository preview."));
  }, [filePath, projectId]);

  const selectedProject = projects.find((project) => project.id === projectId);
  const summary = useMemo(() => summarizeSource(source), [source]);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Imported repository preview</p>
          <h1>Accessibility Experience Mode</h1>
          <p>All simulations are limited to the selected repository preview. They never change the AccessDiff dashboard.</p>
        </div>
      </header>

      {error ? <Card className={styles.error}>{error}</Card> : null}

      <Card className={styles.controls}>
        <label>Imported repository
          <select value={projectId} onChange={(event) => { setSource(""); setFilePath(""); setProjectId(event.target.value); }}>
            <option value="">Select a repository</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name} — {project.github_repo}</option>)}
          </select>
        </label>
        <label>Preview file
          <select value={filePath} onChange={(event) => setFilePath(event.target.value)} disabled={!files.length}>
            <option value="">Select a UI file</option>
            {files.map((file) => <option key={file.path} value={file.path}>{file.path}</option>)}
          </select>
        </label>
      </Card>

      <section className={styles.modeGrid} aria-label="Experience modes">
        {MODES.map((item) => <button key={item.id} type="button" className={mode === item.id ? styles.modeActive : styles.mode} onClick={() => setMode(item.id)}><strong>{item.name}</strong><span>{item.description}</span></button>)}
      </section>

      <Card className={styles.previewCard}>
        <div className={styles.previewHeader}><div><p className={styles.eyebrow}>Live repository preview</p><h2>{selectedProject?.github_repo ?? "Select an imported repository"}</h2><span>{filePath || "No file selected"}</span></div><span className={styles.modeBadge}>{MODES.find((item) => item.id === mode)?.name}</span></div>
        {source ? <iframe title={`Preview of ${filePath}`} sandbox="" className={`${styles.preview} ${styles[mode]}`} srcDoc={toPreviewDocument(source)} /> : <Skeleton height={360} />}
      </Card>

      {(mode === "screen-reader" || mode === "keyboard") && source ? <Card className={styles.assistCard}><h2>{mode === "screen-reader" ? "Screen reader transcript" : "Keyboard tab order"}</h2><p>{mode === "screen-reader" ? summary.announcements : summary.tabStops}</p></Card> : null}
    </div>
  );
}

function toPreviewDocument(source: string): string {
  const markup = source.includes("<") ? source
    .replace(/import[^;]+;?/g, "")
    .replace(/className=/g, "class=")
    .replace(/\{[^}]*\}/g, "preview-value")
    .replace(/\son[A-Z][A-Za-z]*=(?:\"[^\"]*\"|'[^']*'|\{[^}]*\})/g, "")
    : `<pre>${escapeHtml(source)}</pre>`;
  return `<!doctype html><html><head><style>body{font:16px system-ui;padding:24px;color:#151515;background:#fff}button,input,a,select,textarea{margin:6px;padding:8px}img{max-width:100%;height:auto}pre{white-space:pre-wrap}</style></head><body>${markup.replace(/<script[\s\S]*?<\/script>/gi, "")}</body></html>`;
}

function summarizeSource(source: string) {
  const buttons = (source.match(/<button\b/gi) ?? []).length;
  const inputs = (source.match(/<(input|select|textarea)\b/gi) ?? []).length;
  const links = (source.match(/<a\b/gi) ?? []).length;
  const images = (source.match(/<img\b/gi) ?? []).length;
  return { announcements: `Repository preview contains ${buttons} buttons, ${inputs} form controls, ${links} links, and ${images} images.`, tabStops: `Estimated tab order: ${links + buttons + inputs} interactive elements in the selected imported file.` };
}

function escapeHtml(value: string): string { return value.replace(/[&<>]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[character] ?? character); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
function isProject(value: unknown): value is Project { return isRecord(value) && typeof value.id === "string" && typeof value.name === "string" && typeof value.github_repo === "string"; }
function isFile(value: unknown): value is RepositoryFile { return isRecord(value) && typeof value.path === "string" && typeof value.type === "string"; }
