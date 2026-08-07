"use client";

export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <html lang="en"><body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "system-ui", background: "#fbf7f0", color: "#161828" }}><main style={{ textAlign: "center", padding: "2rem" }}><h1>AccessDiff needs to restart this page.</h1><p style={{ color: "#5f6370" }}>Please try again. If it persists, return to the dashboard.</p><button type="button" onClick={retry} style={{ padding: ".75rem 1rem", borderRadius: "12px", border: "2.5px solid #161828", background: "#f97316", color: "#fff", fontWeight: 700, boxShadow: "2px 2px 0 #161828" }}>Try again</button></main></body></html>;
}
