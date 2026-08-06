# AccessDiff — Project Memory

> Long-term architectural memory — continuously updated throughout development

---

## 1. Project Identity

| Key | Value |
|---|---|
| **Name** | AccessDiff |
| **Tagline** | AI Accessibility Copilot for GitHub |
| **Type** | SaaS Web Application |
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript (strict mode) |
| **Styling** | Vanilla CSS (CSS Modules + Custom Properties) |
| **Database** | Supabase (PostgreSQL) |
| **Orchestrator** | Mutagent Helix (ADL lifecycle) |
| **Primary LLM** | Groq API (Llama 3.3 70B) |
| **Voice/NLP** | Sarvam AI |
| **Deployment** | Vercel |

---

## 2. Architecture Decisions Record

| ID | Decision | Rationale | Date |
|---|---|---|---|
| ADR-001 | Next.js monolith | Reduced complexity, co-located API routes | 2026-08-04 |
| ADR-002 | Mutagent Helix as orchestrator | Hackathon requirement, natural ADL mapping | 2026-08-04 |
| ADR-003 | Groq as primary LLM | Fast inference, cost-effective, strong reasoning | 2026-08-04 |
| ADR-004 | Supabase for data & auth | Managed PostgreSQL, built-in GitHub OAuth, RLS | 2026-08-04 |
| ADR-005 | Vanilla CSS with custom properties | Max control, theming, no framework dependency | 2026-08-04 |
| ADR-006 | SSE for pipeline progress | Simpler than WebSocket, unidirectional, native browser support | 2026-08-04 |
| ADR-007 | Codebase Memory Pattern | Use a continuously updated `Memory.md` as the long-term architectural memory instead of blind RAG | 2026-08-04 |
| ADR-008 | Local typed Helix orchestration | The installed Mutagent SDK exposes agent/workspace management, not a Helix execution runtime; compose application-specific agents in a typed local ADL orchestrator | 2026-08-04 |

---

## 3. Key Technical Patterns

### API Response Format
```typescript
// All API routes return:
{ data: T, error: null }           // Success
{ data: null, error: { message, code } }  // Error
```

### Agent Output Format
```typescript
interface AgentOutput<T> {
  success: boolean;
  data: T;
  confidence: number;
  reasoning: string;
  duration_ms: number;
}
```

### Helix ADL Pipeline Mapping
```
SPEC    → RepositoryAgent, GitDiffAgent
BUILD   → AccessibilityAnalysisAgent, ExplanationAgent, FixAgent
EVALUATE → VerificationAgent
DIAGNOSE → DiagnosisAgent
OPTIMIZE → OptimizationAgent
```

---

## 4. Folder Structure

```
src/
├── app/          → Next.js pages and API routes
├── components/   → UI components (organized by domain)
├── agents/       → Mutagent agent definitions
├── lib/          → Shared utilities and API clients
├── hooks/        → React hooks
├── types/        → TypeScript type definitions
└── styles/       → Design system CSS
```

---

## 5. Database Tables

| Table | Purpose |
|---|---|
| `users` | User profiles + GitHub tokens |
| `projects` | Imported GitHub repositories |
| `commits` | Tracked commits per project |
| `pipeline_runs` | Pipeline executions |
| `pipeline_stages` | Individual ADL stages within runs |
| `issues` | Detected accessibility issues |
| `fixes` | AI-generated fixes |
| `governance_logs` | AI decision audit trail |
| `accessibility_scores` | Historical scores for timeline |
| `pull_requests` | Created GitHub PRs |
| `chat_history` | Sarvam AI conversations |

---

## 6. External API Integrations

| Service | Base URL | Auth | Package |
|---|---|---|---|
| GitHub | `https://api.github.com` | OAuth token | `@octokit/rest` (or native fetch) |
| Groq | `https://api.groq.com` | API key | `groq-sdk` |
| Sarvam AI | `https://api.sarvam.ai` | `api-subscription-key` header | Custom client |
| Supabase | Project URL | Anon key / Service role key | `@supabase/supabase-js` |

---

## 7. Design Tokens Summary

| Token Category | Defined In |
|---|---|
| Colors | `tokens.css` — dark palette, orange accent |
| Typography | `typography.css` — Plus Jakarta Sans, JetBrains Mono |
| Spacing | `tokens.css` — 4px base scale |
| Radii | `tokens.css` — 4px–20px scale |
| Shadows | `tokens.css` — 4 elevation levels |
| Animations | `animations.css` — easing curves, durations |

---

## 8. Key Constraints

1. **Mutagent must be the core orchestration layer** — Not a bolt-on.
2. **Regression-only detection** — Only flag issues introduced by new changes.
3. **Every AI decision must have a governance log** — No silent AI actions.
4. **Every AI fix must be verified** — Re-run analysis after fixing.
5. **Every modification must be reversible** — One-click rollback.
6. **The platform itself must be WCAG 2.2 AA compliant.**
7. **Sequential phase implementation** — No jumping between phases.

---

## 9. Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET
GROQ_API_KEY
SARVAM_API_KEY
MUTAGENT_API_KEY
NEXT_PUBLIC_APP_URL
```

---

## 10. Known Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Groq rate limits | Queuing + caching |
| GitHub rate limits | Token bucket, webhook-based updates |
| Mutagent SDK maturity | Abstract behind interfaces |
| Large repos overwhelm pipeline | File filtering, diff-only analysis |
| AI generates incorrect fixes | Verification loop + developer approval |

---

## 11. Current State

| Metric | Value |
|---|---|
| Current Phase | Phase 8 — AI Governance |
| Tasks Completed | 75/124 |
| Documentation Status | ✅ Complete (9/9 files) |
| Implementation Status | Phases 0–7 complete (75/124 tasks) |
| Last Updated | 2026-08-05 |

---

## 12. Decision Log

Chronological record of significant decisions made during development.

| Date | Decision | Context |
|---|---|---|
| 2026-08-04 | Created all 9 documentation files before any implementation | Following documentation-first principle |
| 2026-08-04 | Chose 15-phase implementation plan | Balances granularity with manageability |
| 2026-08-04 | Selected CSS Modules over styled-components | Aligns with vanilla CSS requirement, zero-runtime |
| 2026-08-04 | Chose SSE over WebSocket for pipeline updates | Simpler, unidirectional, auto-reconnect |
| 2026-08-04 | Designed 11 database tables | Covers all features without over-normalization |
| 2026-08-04 | Completed Phase 4 agent foundation | Added local Helix ADL sequencing, optimization, governance audit records, and GitHub PR generation; verified with TypeScript and production build |
| 2026-08-04 | Implemented pipeline backend foundation | Added authenticated pipeline APIs, SSE status streaming, Supabase persistence migration, WCAG mapping, and deterministic diff regression checks |
| 2026-08-05 | Verified the live pipeline | Compared `kachamsiddarth/acessDemo` commits `7fb144b` and `525a5e6`; 7 regressions, generated fixes, verified fixes, and persisted fixes completed successfully |
| 2026-08-05 | Extracted `PipelineView` component | Moved pipeline run/status/results rendering out of the page into `src/components/pipeline/PipelineView/` as a pure presentational component, keeping all data-fetching and SSE logic in the page |
| 2026-08-05 | Completed Phase 6 Pipeline UI & Issue Views | Extracted presentation components (`StageCard`, `ProgressIndicator`, `CommitSelector`, `IssueCard`, `IssueDetail`), integrated `/issues` page with `GET /api/issues` API |
| 2026-08-05 | Completed Phase 7 Fixes & Verification | Connected 7 API keys Groq pool with model fallback, built `DiffViewer`, `TrustScore`, `VerificationStatusIndicator`, `FixActions`, and API routes `approve`, `reject`, and `rollback` |
| 2026-08-06 | Scoped Experience Mode and repaired diff review | Experience simulations now target only a sandboxed imported-repository preview; persisted fix records are joined with issues for the code-diff workspace and the completed pipeline links directly to it. |

---

## 13. Lessons Learned

*This section will be populated during implementation.*

| Date | Lesson | Phase |
|---|---|---|
| — | — | — |

---

*This document must be updated continuously throughout development.*
*Every architectural decision, pattern change, or significant discovery must be recorded here.*
