"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import styles from "./page.module.css";

export default function HomePage() {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    void Promise.all([import("gsap"), import("lenis")]).then(([gsapModule, lenisModule]) => {
      if (cancelled) return;
      const lenis = new lenisModule.default({ smoothWheel: true });
      const tick = (time: number) => { lenis.raf(time); frame = requestAnimationFrame(tick); }; frame = requestAnimationFrame(tick);
      const gsap = gsapModule.default;
      const context = gsap.context(() => { gsap.from("[data-reveal]", { y: 28, opacity: 0, duration: 0.7, stagger: 0.12, ease: "power2.out" }); }, root);
      cleanup = () => { cancelAnimationFrame(frame); lenis.destroy(); context.revert(); };
    });
    return () => { cancelled = true; cleanup?.(); };
  }, []);
  return <main ref={root} className={styles.page}>
    <nav className={styles.nav}><Link href="/" className={styles.brand}>Access<span>Diff</span></Link><Link href="/login" className={styles.signIn}>Sign in with GitHub</Link></nav>
    <section className={styles.hero}><p data-reveal className={styles.kicker}>AI accessibility copilot for GitHub</p><h1 data-reveal>Catch accessibility regressions <em>before</em> they ship.</h1><p data-reveal className={styles.lede}>AccessDiff compares commits, explains only new WCAG issues, generates minimal fixes, and verifies them before you open a pull request.</p><div data-reveal className={styles.ctas}><Link href="/login" className={styles.primary}>Get started with GitHub <span aria-hidden="true">→</span></Link><a href="#workflow" className={styles.secondary}>See how it works</a></div></section>
    <section id="workflow" className={styles.workflow} aria-label="AccessDiff workflow"><article data-reveal><span>01</span><h2>Compare commits</h2><p>Focus on what changed, not historical accessibility debt.</p></article><article data-reveal><span>02</span><h2>Explain and repair</h2><p>Get WCAG context, risk signals, and verified AI fixes.</p></article><article data-reveal><span>03</span><h2>Ship with trust</h2><p>Review before/after code, create a PR, and retain a governance trail.</p></article></section>
    <section className={styles.demo} data-reveal><div><p className={styles.kicker}>Regression-first engineering</p><h2>One workflow for every pull request.</h2><p>Built for developers who need accessibility feedback in the same place they review code.</p></div><div className={styles.terminal} aria-label="Example pipeline result"><div><i /> Pipeline complete <b>7 new issues</b></div><code>src/components/Header.tsx<br /><s>- &lt;img src=&quot;/logo.svg&quot; /&gt;</s><br /><ins>+ &lt;img src=&quot;/logo.svg&quot; alt=&quot;AccessDiff&quot; /&gt;</ins></code><footer>Verified fix · WCAG 1.1.1 · Ready for review</footer></div></section>
    <section className={styles.finalCta} data-reveal><p className={styles.kicker}>Make accessibility continuous</p><h2>Give every commit an accessibility reviewer.</h2><Link href="/login" className={styles.primary}>Connect GitHub <span aria-hidden="true">→</span></Link></section><footer className={styles.footer}>© 2026 AccessDiff · WCAG 2.2-minded engineering</footer>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "SoftwareApplication", name: "AccessDiff", applicationCategory: "DeveloperApplication", description: "AI accessibility regression analysis for GitHub repositories." }) }} />
  </main>;
}
