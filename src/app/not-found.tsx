import Link from "next/link";

export default function NotFound() {
  return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "2rem", background: "var(--color-bg-base)", color: "var(--color-text-primary)" }}><section style={{ textAlign: "center" }}><p style={{ color: "var(--color-accent)", fontWeight: 700 }}>404</p><h1>This view does not exist.</h1><p style={{ color: "var(--color-text-secondary)" }}>The page may have moved, or the repository resource is no longer available.</p><Link href="/dashboard">Return to dashboard</Link></section></main>;
}
