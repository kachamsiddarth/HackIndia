"use client";

import { useEffect, useState } from "react";
import { Card, Input, Skeleton } from "@/components/ui";
import { GovernanceLogCard, GovernanceTimeline } from "@/components/governance";
import type { GovernanceRecord } from "@/components/governance";
import styles from "./page.module.css";

type ViewMode = "cards" | "timeline";

export default function GovernancePage() {
  const [records, setRecords] = useState<GovernanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [agentFilter, setAgentFilter] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [selectedRecord, setSelectedRecord] = useState<GovernanceRecord | null>(null);

  useEffect(() => {
    async function loadRecords() {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (agentFilter !== "all") params.set("agent", agentFilter);

        const res = await fetch(`/api/governance?${params.toString()}`);
        const json = await res.json();

        if (json.data) {
          setRecords(json.data.records || []);
        }
      } catch (err) {
        console.error("Failed to fetch governance records:", err);
      } finally {
        setLoading(false);
      }
    }

    const timer = setTimeout(() => {
      void loadRecords();
    }, 200);

    return () => clearTimeout(timer);
  }, [search, agentFilter]);

  const uniqueAgents = [...new Set(records.map((r) => r.agentName))];

  return (
    <div className={styles.container}>
      <div>
        <p className={styles.eyebrow}>Autonomous AI Oversight</p>
        <h1 className={styles.title}>Governance Audit Trail</h1>
        <p className={styles.description}>
          Complete transparency into every AI agent decision, fix verification, and approval action across your AccessDiff pipeline runs.
        </p>
      </div>

      <Card className={styles.controls} padding="md">
        <div className={styles.searchGroup}>
          <Input
            label="Search governance logs"
            hideLabel
            placeholder="Search by agent, action, or reasoning..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className={styles.select}
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          aria-label="Filter by agent"
        >
          <option value="all">All Agents</option>
          {uniqueAgents.map((agent) => (
            <option key={agent} value={agent}>{agent}</option>
          ))}
        </select>

        <div className={styles.viewToggle}>
          <button
            type="button"
            className={`${styles.toggleBtn} ${viewMode === "cards" ? styles.toggleBtnActive : ""}`}
            onClick={() => setViewMode("cards")}
          >
            Cards
          </button>
          <button
            type="button"
            className={`${styles.toggleBtn} ${viewMode === "timeline" ? styles.toggleBtnActive : ""}`}
            onClick={() => setViewMode("timeline")}
          >
            Timeline
          </button>
        </div>
      </Card>

      {loading ? (
        <div className={styles.grid}>
          <Skeleton height={120} />
          <Skeleton height={120} />
          <Skeleton height={120} />
        </div>
      ) : records.length > 0 ? (
        viewMode === "cards" ? (
          <div className={styles.grid}>
            {records.map((record) => (
              <GovernanceLogCard
                key={record.id}
                record={record}
                onSelect={(r) => setSelectedRecord(r)}
              />
            ))}
          </div>
        ) : (
          <Card padding="lg">
            <GovernanceTimeline records={records} />
          </Card>
        )
      ) : (
        <Card className={styles.emptyState}>
          <h3>No Governance Records</h3>
          <p>
            {search || agentFilter !== "all"
              ? "No records match your current filter criteria."
              : "Run an AccessDiff pipeline to generate AI governance audit logs."}
          </p>
        </Card>
      )}

      {/* Detail overlay */}
      {selectedRecord && (
        <div
          className={styles.detailOverlay}
          onClick={() => setSelectedRecord(null)}
          role="dialog"
          aria-label="Governance record detail"
        >
          <div className={styles.detailPanel} onClick={(e) => e.stopPropagation()}>
            <div className={styles.detailHeader}>
              <h2 className={styles.detailTitle}>{selectedRecord.agentName}</h2>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setSelectedRecord(null)}
                aria-label="Close detail"
              >
                ✕
              </button>
            </div>

            <div className={styles.metaRow}>
              <div className={styles.metaItem}>
                <div className={styles.metaLabel}>Action</div>
                <div className={styles.metaValue}>{selectedRecord.action}</div>
              </div>
              <div className={styles.metaItem}>
                <div className={styles.metaLabel}>Confidence</div>
                <div className={styles.metaValue}>
                  {Math.round(selectedRecord.confidence > 1 ? selectedRecord.confidence : selectedRecord.confidence * 100)}%
                </div>
              </div>
              <div className={styles.metaItem}>
                <div className={styles.metaLabel}>Pipeline Run</div>
                <div className={styles.metaValue}>{selectedRecord.pipelineRunId?.slice(0, 8) ?? "—"}</div>
              </div>
              <div className={styles.metaItem}>
                <div className={styles.metaLabel}>Timestamp</div>
                <div className={styles.metaValue}>
                  {new Date(selectedRecord.createdAt).toLocaleString()}
                </div>
              </div>
            </div>

            <div>
              <div className={styles.metaLabel} style={{ marginBottom: "0.35rem" }}>Reasoning</div>
              <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.5, color: "var(--color-text-primary)" }}>
                {selectedRecord.reasoning}
              </p>
            </div>

            {selectedRecord.metadata && Object.keys(selectedRecord.metadata).length > 0 && (
              <div>
                <div className={styles.metaLabel} style={{ marginBottom: "0.35rem" }}>Raw Metadata</div>
                <pre style={{
                  margin: 0,
                  padding: "0.75rem",
                  background: "var(--color-bg-base)",
                  borderRadius: "var(--radius-md)",
                  fontSize: "0.78rem",
                  overflow: "auto",
                  maxHeight: "200px",
                  fontFamily: "var(--font-mono, monospace)",
                  color: "var(--color-text-secondary)",
                }}>
                  {JSON.stringify(selectedRecord.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
