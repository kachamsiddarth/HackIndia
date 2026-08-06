"use client";

export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <html lang="en"><body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "system-ui", background: "#0d0e14", color: "#f2f2f2" }}><main style={{ textAlign: "center", padding: "2rem" }}><h1>AccessDiff needs to restart this page.</h1><p style={{ color: "#b0b2bd" }}>Please try again. If it persists, return to the dashboard.</p><button type="button" onClick={retry} style={{ padding: ".75rem 1rem", borderRadius: "8px", border: 0, background: "#f97316", color: "#0d0e14", fontWeight: 700 }}>Try again</button></main></body></html>;
}
