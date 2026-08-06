"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => { console.error("AccessDiff route error:", error); }, [error]);
  return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "2rem", background: "var(--color-bg-base)", color: "var(--color-text-primary)" }}><section style={{ maxWidth: "34rem", textAlign: "center" }}><p style={{ color: "var(--color-accent)", fontWeight: 700 }}>RECOVERABLE ERROR</p><h1>Something interrupted this view.</h1><p style={{ color: "var(--color-text-secondary)" }}>Your repository and pipeline data are safe. Try loading this view again or return to the dashboard.</p><div style={{ display: "flex", justifyContent: "center", gap: "1rem", marginTop: "1.5rem" }}><button type="button" onClick={retry} style={{ padding: ".75rem 1rem", borderRadius: "var(--radius-md)", background: "var(--color-accent)", color: "var(--color-text-inverse)" }}>Try again</button><Link href="/dashboard">Go to dashboard</Link></div></section></main>;
}
