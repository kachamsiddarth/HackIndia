"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { CodeBlock, FileExplorer, type FileItem, type CodeIssueAnnotation } from "@/components/explorer";
import { Skeleton } from "@/components/ui";
import styles from "./page.module.css";

interface ExplorerPageProps {
  params: Promise<{ id: string }>;
}

export default function RepositoryExplorerPage(props: ExplorerPageProps) {
  const { id: projectId } = use(props.params);

  const [files, setFiles] = useState<FileItem[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [selectedFile, setSelectedFile] = useState<string | undefined>();
  const [fileContent, setFileContent] = useState<string>("");
  const [fileIssues, setFileIssues] = useState<CodeIssueAnnotation[]>([]);
  const [loadingContent, setLoadingContent] = useState(false);

  useEffect(() => {
    async function loadTree() {
      try {
        setLoadingFiles(true);
        const res = await fetch(`/api/projects/${projectId}/files`);
        const json = await res.json();

        if (json.data?.files) {
          setFiles(json.data.files);
          // Auto select first file if available
          const firstFile = json.data.files.find((f: FileItem) => f.type !== "dir");
          if (firstFile) {
            setSelectedFile(firstFile.path);
          }
        }
      } catch (err) {
        console.error("Failed to load file tree:", err);
      } finally {
        setLoadingFiles(false);
      }
    }

    void loadTree();
  }, [projectId]);

  useEffect(() => {
    if (!selectedFile) return;

    async function loadContent() {
      try {
        setLoadingContent(true);
        const res = await fetch(`/api/projects/${projectId}/files/content?path=${encodeURIComponent(selectedFile ?? "")}`);
        const json = await res.json();

        if (json.data) {
          setFileContent(json.data.content || "");
          setFileIssues(json.data.issues || []);
        }
      } catch (err) {
        console.error("Failed to load file content:", err);
      } finally {
        setLoadingContent(false);
      }
    }

    void loadContent();
  }, [projectId, selectedFile]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Codebase Explorer</h1>
        </div>
        <Link href={`/projects/${projectId}`} className={styles.backLink}>
          Back to project
        </Link>
      </div>

      <div className={styles.layout}>
        {loadingFiles ? (
          <Skeleton height={400} />
        ) : (
          <FileExplorer
            files={files}
            selectedPath={selectedFile}
            onSelectFile={(path) => setSelectedFile(path)}
          />
        )}

        {loadingContent ? (
          <Skeleton height={400} />
        ) : selectedFile ? (
          <CodeBlock
            filePath={selectedFile}
            content={fileContent}
            issues={fileIssues}
          />
        ) : (
          <div className={styles.emptyState}>
            Select a file from the explorer to view code & accessibility annotations.
          </div>
        )}
      </div>
    </div>
  );
}
