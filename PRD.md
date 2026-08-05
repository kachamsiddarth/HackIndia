# AccessDiff — Product Requirements Document

> **"AI Accessibility Copilot for GitHub"**

---

## 1. Executive Summary

AccessDiff is an AI-powered Accessibility Engineering Platform that performs **Accessibility Regression Analysis** on GitHub repositories. Unlike traditional accessibility scanners that audit entire codebases indiscriminately, AccessDiff compares previous commits with new commits to detect **only newly introduced accessibility issues**.

By integrating into the developer workflow at the commit and pull request level, AccessDiff makes accessibility a continuous, transparent, and automated part of every code change — not an afterthought.

The platform is built around **Mutagent Helix**, an AI orchestration layer that coordinates specialized agents through the Agentic Development Lifecycle (ADL): SPEC → BUILD → EVALUATE → DIAGNOSE → OPTIMIZE.

---

## 2. Problem Statement

### The Accessibility Gap

- **1 billion people** worldwide live with some form of disability.
- Over **96% of the top 1 million websites** have detectable WCAG failures.
- Accessibility violations are often introduced incrementally through code changes, but developers lack tools to catch them at the point of introduction.
- Existing tools scan entire codebases, producing overwhelming noise. Developers cannot distinguish new violations from legacy debt.
- Manual accessibility audits are expensive, slow, and happen too late in the development cycle.

### Developer Pain Points

| Pain Point | Current State | AccessDiff Solution |
|---|---|---|
| Overwhelming audit reports | Scan entire site, get 500+ issues | Only show issues introduced by this commit |
| No CI/CD integration | Run scanners manually | Automated pipeline on every push |
| No fix guidance | "Missing alt text" with no context | AI-generated minimal diffs with explanations |
| No verification | Assume fix is correct | Continuous re-verification after every fix |
| No accountability | AI suggestions are opaque | Full governance trail with trust scores |
| No learning | Fix and forget | Teaching mode with WCAG explanations |

---

## 3. Target Users

### Primary Persona — The Accessibility-Aware Developer

- **Name:** Priya, Frontend Engineer
- **Role:** Mid-level developer at a SaaS company
- **Behavior:** Wants to write accessible code but lacks deep WCAG knowledge
- **Goal:** Catch accessibility regressions before they reach production
- **Frustration:** Existing scanners are noisy and don't integrate into her workflow

### Secondary Persona — The Engineering Lead

- **Name:** Arjun, VP Engineering
- **Role:** Manages 5 frontend teams
- **Behavior:** Needs visibility into accessibility compliance across repositories
- **Goal:** Enforce accessibility standards without slowing down velocity
- **Frustration:** No way to measure accessibility improvement over time

### Tertiary Persona — The Accessibility Specialist

- **Name:** Maya, Accessibility Consultant
- **Role:** Reviews code for WCAG compliance
- **Behavior:** Audits PRs manually, writes reports
- **Goal:** Automated first-pass analysis to focus manual effort
- **Frustration:** Spends 80% of time on detectable, automatable issues

---

## 4. Product Principles

1. **Regression, not scanning.** Only flag issues introduced by this change.
2. **Developer-first.** Integrate into existing workflows (GitHub, CI/CD, PRs).
3. **Explain, don't just flag.** Every issue includes why, impact, and how to fix.
4. **Trust, don't assume.** Every AI decision has a trust score and governance trail.
5. **Teach, don't gatekeep.** Every fix is a learning opportunity.
6. **Verify, don't hope.** Every AI fix is re-tested before acceptance.
7. **Accessible by design.** The platform itself must be fully accessible.

---

## 5. Feature Requirements

### 5.1 Authentication & Onboarding

| ID | Feature | Priority | Description |
|---|---|---|---|
| F-001 | GitHub OAuth Login | P0 | Sign in with GitHub. No email/password. |
| F-002 | Repository Import | P0 | Select repositories to monitor from GitHub account. |
| F-003 | Onboarding Flow | P1 | Guided walkthrough of platform capabilities. |

### 5.2 Repository Understanding

| ID | Feature | Priority | Description |
|---|---|---|---|
| F-010 | Repository Analysis | P0 | AI-powered analysis of project type, framework, architecture, folder structure. |
| F-011 | Risk Area Detection | P0 | Identify accessibility-critical areas (forms, navigation, modals, media). |
| F-012 | Project Summary | P1 | Generate human-readable AI summary of the repository. |

### 5.3 Git Diff Analysis

| ID | Feature | Priority | Description |
|---|---|---|---|
| F-020 | Commit Comparison | P0 | Compare two commits to identify modified files. |
| F-021 | Diff Extraction | P0 | Extract added/removed/modified lines from each file. |
| F-022 | Accessibility-Relevant Filtering | P0 | Filter diffs to only files with accessibility implications (HTML, JSX, TSX, Vue, Svelte, CSS). |

### 5.4 Accessibility Analysis Pipeline

| ID | Feature | Priority | Description |
|---|---|---|---|
| F-030 | Rule-Based Analysis | P0 | Run axe-core and Lighthouse against rendered components. |
| F-031 | AI Reasoning Layer | P0 | Augment rule-based results with Groq-powered contextual analysis. |
| F-032 | WCAG 2.2 Mapping | P0 | Map every issue to specific WCAG 2.2 success criteria. |
| F-033 | Regression Detection | P0 | Distinguish new issues from pre-existing ones. |
| F-034 | Severity Classification | P0 | Classify issues as Critical, Major, Minor, Advisory. |

### 5.5 Issue Reporting

| ID | Feature | Priority | Description |
|---|---|---|---|
| F-040 | Structured Issue Report | P0 | File, line, severity, WCAG rule, description, confidence, affected users, technical explanation, business impact, accessibility impact, expected improvement. |
| F-041 | Risk Classification | P0 | Low Risk → Automatic Fix. High Risk → Developer Approval. |

### 5.6 AI Fix Generation

| ID | Feature | Priority | Description |
|---|---|---|---|
| F-050 | Minimal Diff Generation | P0 | Generate Git-compatible diffs that fix the issue. |
| F-051 | Style-Aware Fixes | P1 | Respect project coding conventions (indentation, naming, framework idioms). |
| F-052 | Multi-Fix Batching | P1 | Group related fixes into a single coherent changeset. |

### 5.7 Continuous Verification

| ID | Feature | Priority | Description |
|---|---|---|---|
| F-060 | Fix Verification | P0 | Re-run accessibility analysis after applying fix. |
| F-061 | Rejection Loop | P0 | If verification fails → Diagnose → Optimize → Re-verify. |
| F-062 | Max Iteration Limit | P1 | Cap verification loops at 3 iterations to prevent infinite loops. |

### 5.8 Visualization & Comparison

| ID | Feature | Priority | Description |
|---|---|---|---|
| F-070 | Code Diff View | P0 | GitHub-style diff viewer with added/removed/modified highlighting. |
| F-071 | Before/After Preview | P1 | Side-by-side rendered preview of component before and after fix. |
| F-072 | Repository Explorer | P1 | GitHub-like file browser with affected line highlighting. |

### 5.9 AI Governance & Trust

| ID | Feature | Priority | Description |
|---|---|---|---|
| F-080 | Trust Score | P0 | Every AI suggestion includes confidence, reasoning, verification status. |
| F-081 | Audit Log | P0 | Complete record of every AI decision with timestamp, input, output, approval. |
| F-082 | One-Click Rollback | P0 | Revert any AI modification instantly. |
| F-083 | Approval Workflow | P1 | High-risk changes require explicit developer approval. |

### 5.10 Pull Request Generation

| ID | Feature | Priority | Description |
|---|---|---|---|
| F-090 | Auto PR Creation | P0 | Generate GitHub PRs with accessibility summary, files modified, verification results. |
| F-091 | PR Body Formatting | P1 | Well-structured Markdown PR body with tables and checklists. |

### 5.11 Accessibility Timeline

| ID | Feature | Priority | Description |
|---|---|---|---|
| F-100 | Score History | P1 | Track accessibility score across commits over time. |
| F-101 | Timeline Visualization | P1 | Interactive chart showing score trends, regressions, improvements. |

### 5.12 Sarvam AI Assistant

| ID | Feature | Priority | Description |
|---|---|---|---|
| F-110 | Text Chat | P1 | Ask questions about issues, code, WCAG rules. |
| F-111 | Voice Chat | P2 | Voice-based interaction powered by Sarvam AI (Indian language support). |
| F-112 | Contextual Help | P1 | Assistant has context of current issue/file/repository. |

### 5.13 Accessibility Experience Mode

| ID | Feature | Priority | Description |
|---|---|---|---|
| F-120 | Screen Reader Simulation | P2 | Simulate screen reader interpretation of the page. |
| F-121 | Keyboard Navigation View | P2 | Visualize tab order and focus management. |
| F-122 | Color Blindness Filter | P2 | Apply color blindness simulation filters. |
| F-123 | High Contrast Mode | P2 | Toggle high contrast view. |

### 5.14 CI/CD Integration

| ID | Feature | Priority | Description |
|---|---|---|---|
| F-130 | GitHub Actions Workflow | P1 | Provide GitHub Actions YAML for automated pipeline. |
| F-131 | Merge Gating | P1 | Block merge if accessibility score drops below threshold. |

### 5.15 Learning Mode

| ID | Feature | Priority | Description |
|---|---|---|---|
| F-140 | Fix Explanations | P0 | Every fix explains why, how, best practice, related WCAG rule. |
| F-141 | WCAG Reference Links | P1 | Direct links to WCAG 2.2 documentation for each rule. |

---

## 6. Non-Functional Requirements

| Requirement | Target |
|---|---|
| First Meaningful Paint | < 1.5s |
| Time to Interactive | < 3s |
| API Response Time (p95) | < 2s (excluding AI inference) |
| AI Pipeline Completion | < 60s for typical PR (< 20 files) |
| Concurrent Users | Support 100 concurrent users |
| Uptime | 99.5% |
| Accessibility | WCAG 2.2 AA compliance for the platform itself |
| Browser Support | Chrome, Firefox, Safari, Edge (latest 2 versions) |
| Mobile | Responsive design (not a primary target) |

---

## 7. Success Metrics

| Metric | Target |
|---|---|
| Accessibility issues detected per scan | > 80% of automatable WCAG violations |
| Fix acceptance rate | > 70% of AI-generated fixes accepted |
| Verification pass rate | > 85% of fixes pass re-verification |
| Time to first scan | < 5 minutes from repository import |
| Developer satisfaction (NPS) | > 40 |

---

## 8. Out of Scope (v1)

- Real-time collaborative editing
- Support for non-GitHub VCS (GitLab, Bitbucket)
- Mobile native apps
- Custom rule authoring
- Team/org management with role-based access
- Billing and subscription management
- Self-hosted deployment

---

## 9. Dependencies

| Dependency | Purpose | Risk |
|---|---|---|
| GitHub API | Repository access, PR creation | Rate limits, OAuth complexity |
| Groq API | LLM inference for all AI agents | Rate limits, model availability |
| Sarvam AI | Voice/text assistant with Indian language support | API availability |
| Supabase | Database, auth, storage | Vendor lock-in (mitigated by PostgreSQL compatibility) |
| Mutagent/Helix | Agent orchestration | SDK maturity |
| axe-core | Rule-based accessibility testing | Well-established, low risk |
| Playwright | Browser automation for rendering | Resource-intensive |

---

## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| AI generates incorrect fixes | Broken code pushed to repos | Continuous verification + developer approval for high-risk |
| Groq API rate limits | Slow pipeline | Implement queuing, caching, and graceful degradation |
| GitHub API rate limits | Failed repository imports | Token bucket rate limiting, webhook-based updates |
| Large repositories overwhelm pipeline | Timeouts | File filtering, incremental analysis, diff-only scanning |
| Mutagent SDK instability | Backend failures | Abstract orchestration layer behind interfaces |

---

*Document Version: 1.0*
*Last Updated: 2026-08-04*
*Status: DRAFT — Awaiting Review*
