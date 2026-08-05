"use client";

import { type ReactNode, useState } from "react";
import styles from "./FileExplorer.module.css";

export interface FileItem {
  path: string;
  type: string;
  size?: number;
  issueCount?: number;
}

export interface FileExplorerProps {
  files: FileItem[];
  selectedPath?: string;
  onSelectFile: (path: string) => void;
}

interface TreeNode {
  name: string;
  path: string;
  type: "file" | "dir";
  children: TreeNode[];
  issueCount?: number;
}

function buildTree(files: FileItem[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const file of files) {
    const parts = file.path.split("/");
    let currentLevel = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1 && file.type !== "dir";
      const existing = currentLevel.find((node) => node.name === part);

      if (existing) {
        if (!isFile) {
          currentLevel = existing.children;
        }
      } else {
        const newNode: TreeNode = {
          name: part,
          path: parts.slice(0, i + 1).join("/"),
          type: isFile ? "file" : "dir",
          children: [],
          issueCount: isFile ? file.issueCount : 0,
        };
        currentLevel.push(newNode);
        if (!isFile) {
          currentLevel = newNode.children;
        }
      }
    }
  }

  return root;
}

/**
 * File explorer tree component for navigating codebase files.
 */
export default function FileExplorer({
  files,
  selectedPath,
  onSelectFile,
}: FileExplorerProps): ReactNode {
  const treeNodeList = buildTree(files);

  return (
    <div className={styles.explorer}>
      <div className={styles.header}>
        <span>Files ({files.length})</span>
      </div>
      <div className={styles.tree} role="tree" aria-label="Repository files">
        {treeNodeList.map((node) => (
          <TreeNodeView
            key={node.path}
            node={node}
            depth={0}
            selectedPath={selectedPath}
            onSelectFile={onSelectFile}
          />
        ))}
      </div>
    </div>
  );
}

function TreeNodeView({
  node,
  depth,
  selectedPath,
  onSelectFile,
}: {
  node: TreeNode;
  depth: number;
  selectedPath?: string;
  onSelectFile: (path: string) => void;
}): ReactNode {
  const [expanded, setExpanded] = useState(true);

  if (node.type === "dir") {
    return (
      <div>
        <div
          className={styles.item}
          style={{ paddingLeft: `${depth * 0.75 + 0.5}rem` }}
          onClick={() => setExpanded(!expanded)}
          role="treeitem"
          aria-expanded={expanded}
          aria-selected={false}
        >
          <span className={styles.icon}>{expanded ? "📂" : "📁"}</span>
          <span className={styles.name}>{node.name}</span>
        </div>
        {expanded && (
          <div>
            {node.children.map((child) => (
              <TreeNodeView
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedPath={selectedPath}
                onSelectFile={onSelectFile}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const isSelected = selectedPath === node.path;
  const itemClass = `${styles.item} ${isSelected ? styles.itemSelected : ""}`;

  return (
    <div
      className={itemClass}
      style={{ paddingLeft: `${depth * 0.75 + 0.5}rem` }}
      onClick={() => onSelectFile(node.path)}
      role="treeitem"
      aria-selected={isSelected}
    >
      <span className={styles.icon}>📄</span>
      <span className={styles.name}>{node.name}</span>
      {node.issueCount && node.issueCount > 0 ? (
        <span className={styles.badge}>{node.issueCount}</span>
      ) : null}
    </div>
  );
}
