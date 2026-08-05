# AccessDiff — Technical Requirements Document

> Technology Stack, Architecture Decisions & Integration Specifications

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js 16)                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │Dashboard │ │Pipeline  │ │Repo      │ │Diff      │ │Assistant │ │
│  │          │ │Viewer    │ │Explorer  │ │Viewer    │ │(Sarvam)  │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ REST + Server-Sent Events
┌──────────────────────────▼──────────────────────────────────────────┐
│                     API LAYER (Next.js API Routes)                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │Auth      │ │Repos     │ │Pipeline  │ │Governance│ │Assistant │ │
│  │Routes    │ │Routes    │ │Routes    │ │Routes    │ │Routes    │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────────┐
│                  ORCHESTRATION (Mutagent Helix)                      │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                     Helix Orchestrator                       │    │
│  │  SPEC → BUILD → EVALUATE → DIAGNOSE → OPTIMIZE              │    │
│  └─────────────────────────┬───────────────────────────────────┘    │
│                             │                                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐              │
│  │Repository│ │GitDiff   │ │A11y      │ │A11y      │              │
│  │Agent     │ │Agent     │ │Analysis  │ │Explanation│              │
│  └──────────┘ └──────────┘ │Agent     │ │Agent     │              │
│  ┌──────────┐ ┌──────────┐ └──────────┘ └──────────┘              │
│  │A11y Fix  │ │Verify    │ ┌──────────┐ ┌──────────┐              │
│  │Agent     │ │Agent     │ │Diagnosis │ │Optimize  │              │
│  └──────────┘ └──────────┘ │Agent     │ │Agent     │              │
│  ┌──────────┐ ┌──────────┐ └──────────┘ └──────────┘              │
│  │Governance│ │PR        │ ┌──────────┐                            │
│  │Agent     │ │Agent     │ │Sarvam    │                            │
│  └──────────┘ └──────────┘ │Assistant │                            │
│                             └──────────┘                            │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────────┐
│                      EXTERNAL SERVICES                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐              │
│  │GitHub    │ │Groq      │ │Sarvam    │ │Supabase  │              │
│  │API       │ │API       │ │AI API    │ │          │              │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                           │
│  │axe-core  │ │Playwright│ │Lighthouse│                           │
│  └──────────┘ └──────────┘ └──────────┘                           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Technology Stack

### 2.1 Frontend

| Technology | Version | Purpose |
|---|---|---|
| **Next.js** | 16.x (App Router) | Full-stack React framework |
| **React** | 19.x | UI library |
| **TypeScript** | 5.x | Type safety |
| **Vanilla CSS** | — | Styling (CSS custom properties, CSS modules) |
| **GSAP** | 3.x | Scroll and element animations |
| **Lenis** | 1.x | Smooth scrolling |
| **Rive** | — | Interactive vector animations (logo, loading states) |
| **Monaco Editor** | 0.x | Code viewing and diff rendering |
| **Recharts** | 2.x | Charts and timeline visualization |
| **Lucide React** | — | Icon library |

### 2.2 Backend

| Technology | Version | Purpose |
|---|---|---|
| **Next.js Route Handlers** | 16.x | API layer (co-located with frontend) |
| **Mutagent Helix** | latest | Agent orchestration (ADL lifecycle) |
| **@mutagent/sdk** | latest | Mutagent SDK for tracing and evaluation |
| **@mutagent/evaluator** | latest | Agent output evaluation |
| **@mutagent/diagnostics** | latest | Agent failure diagnostics |

### 2.3 AI / LLM

| Technology | Purpose |
|---|---|
| **Groq API** (`groq-sdk`) | Primary LLM for all agents (Llama 3.3 70B) |
| **Sarvam AI** (REST API) | Voice/text assistant, Indian language support |

### 2.4 Accessibility Testing

| Technology | Purpose |
|---|---|
| **axe-core** | Rule-based WCAG 2.2 analysis |
| **@axe-core/playwright** | Playwright integration for axe-core |
| **Playwright** | Browser automation for rendering pages |
| **Lighthouse** (via `lighthouse` npm) | Performance + accessibility auditing |

### 2.5 Database & Auth

| Technology | Purpose |
|---|---|
| **Supabase** | PostgreSQL database, Auth (GitHub OAuth), Row Level Security |
| **@supabase/supabase-js** | Client SDK |
| **@supabase/ssr** | Server-side rendering helpers for Next.js |

### 2.6 External APIs

| API | Purpose | Auth Method |
|---|---|---|
| **GitHub REST API v3** | Repository data, commits, diffs, PRs | OAuth token |
| **GitHub GraphQL API v4** | Efficient repository queries | OAuth token |
| **Groq API** | LLM inference | API key |
| **Sarvam AI API** | STT, TTS, chat | API subscription key |

### 2.7 Dev Tooling

| Tool | Purpose |
|---|---|
| **ESLint** | Code linting |
| **Prettier** | Code formatting |
| **TypeScript** | Static type checking |

---

## 3. Key Architecture Decisions

### ADR-001: Next.js Monolith over Microservices

**Decision:** Use Next.js App Router as a full-stack monolith (frontend + API routes) rather than separate frontend/backend services.

**Rationale:**
- Reduces deployment complexity for a hackathon/early-stage product
- API routes co-located with pages reduce latency
- Server Components eliminate redundant client-server round trips
- Single deployment unit on Vercel
- Can extract microservices later if needed

**Trade-offs:** API routes share the same Node.js process; CPU-intensive tasks (Playwright, Lighthouse) must be offloaded to background jobs or edge functions.

---

### ADR-002: Mutagent Helix as Core Orchestrator

**Decision:** Use Mutagent Helix to orchestrate all AI agent workflows through the ADL lifecycle.

**Rationale:**
- Hackathon requirement (core platform)
- Natural mapping: SPEC (define analysis scope) → BUILD (run agents) → EVALUATE (verify fixes) → DIAGNOSE (root cause failures) → OPTIMIZE (improve fixes)
- Built-in tracing, evaluation, and diagnostics
- Agent skills as modular, testable units

**Implementation:**
```
Helix Pipeline for Accessibility Scan:

SPEC Stage:
  → RepositoryAgent: Understand repo structure
  → GitDiffAgent: Extract changed files

BUILD Stage:
  → AccessibilityAnalysisAgent: Run analysis
  → AccessibilityExplanationAgent: Generate explanations
  → AccessibilityFixAgent: Generate fixes

EVALUATE Stage:
  → VerificationAgent: Verify fixes pass

DIAGNOSE Stage (if verification fails):
  → DiagnosisAgent: Root cause analysis

OPTIMIZE Stage (if diagnosis identified fixable issues):
  → OptimizationAgent: Improve fixes
  → Loop back to EVALUATE (max 3 iterations)

POST-PIPELINE:
  → GovernanceAgent: Record audit trail
  → PullRequestAgent: Create GitHub PR
```

---

### ADR-003: Groq as Primary LLM

**Decision:** Use Groq API with Llama 3.3 70B as the primary LLM for all agents.

**Rationale:**
- Extremely fast inference (< 500 tokens/sec)
- Cost-effective for high-volume agent calls
- Llama 3.3 70B offers strong reasoning capability
- Compatible with OpenAI-style API for easy migration

**Fallback:** If Groq is unavailable, surface a clear error rather than silently degrading to a weaker model.

---

### ADR-004: Supabase for Data & Auth

**Decision:** Use Supabase for PostgreSQL database, GitHub OAuth, and Row Level Security.

**Rationale:**
- Managed PostgreSQL with real-time capabilities
- Built-in GitHub OAuth provider
- Row Level Security for multi-tenant data isolation
- Generous free tier for development
- Client SDKs for both browser and server

---

### ADR-005: Vanilla CSS with CSS Custom Properties

**Decision:** Use CSS Modules + CSS Custom Properties for styling. No CSS frameworks.

**Rationale:**
- Maximum control over the design system
- CSS custom properties enable theming (dark mode, high contrast)
- CSS Modules prevent style collisions
- No build-time CSS processing overhead
- Follows the user's explicit requirement

---

### ADR-006: Server-Sent Events for Pipeline Progress

**Decision:** Use Server-Sent Events (SSE) for real-time pipeline progress updates instead of WebSockets.

**Rationale:**
- Simpler than WebSockets for unidirectional server-to-client streaming
- Native browser support via `EventSource`
- Works with Next.js API routes
- No need for a separate WebSocket server
- Automatic reconnection built into the browser API

---

## 4. Project Structure

```
accessdiff/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (auth)/                   # Auth routes group
│   │   │   ├── login/
│   │   │   └── callback/
│   │   ├── (dashboard)/              # Authenticated routes group
│   │   │   ├── dashboard/
│   │   │   ├── project/[id]/
│   │   │   │   ├── pipeline/
│   │   │   │   ├── explorer/
│   │   │   │   ├── issues/
│   │   │   │   ├── timeline/
│   │   │   │   └── governance/
│   │   │   └── settings/
│   │   ├── api/                      # API Routes
│   │   │   ├── auth/
│   │   │   ├── repos/
│   │   │   ├── pipeline/
│   │   │   ├── issues/
│   │   │   ├── governance/
│   │   │   ├── assistant/
│   │   │   └── webhooks/
│   │   ├── layout.tsx
│   │   ├── page.tsx                  # Landing page
│   │   └── globals.css
│   │
│   ├── components/                   # Shared UI components
│   │   ├── ui/                       # Design system primitives
│   │   │   ├── Button/
│   │   │   ├── Card/
│   │   │   ├── Badge/
│   │   │   ├── Input/
│   │   │   ├── Modal/
│   │   │   ├── Skeleton/
│   │   │   └── Toast/
│   │   ├── layout/                   # Layout components
│   │   │   ├── Sidebar/
│   │   │   ├── Header/
│   │   │   └── Container/
│   │   ├── pipeline/                 # Pipeline-specific components
│   │   │   ├── PipelineView/
│   │   │   ├── StageCard/
│   │   │   └── ProgressIndicator/
│   │   ├── code/                     # Code viewing components
│   │   │   ├── DiffViewer/
│   │   │   ├── CodeBlock/
│   │   │   └── FileExplorer/
│   │   ├── issues/                   # Issue components
│   │   │   ├── IssueCard/
│   │   │   ├── IssueDetail/
│   │   │   └── TrustScore/
│   │   ├── assistant/                # Sarvam AI components
│   │   │   ├── ChatPanel/
│   │   │   └── VoiceInput/
│   │   └── charts/                   # Visualization components
│   │       ├── TimelineChart/
│   │       └── ScoreGauge/
│   │
│   ├── agents/                       # Mutagent Agent definitions
│   │   ├── helix.ts                  # Helix orchestrator setup
│   │   ├── repository.agent.ts
│   │   ├── gitdiff.agent.ts
│   │   ├── analysis.agent.ts
│   │   ├── explanation.agent.ts
│   │   ├── fix.agent.ts
│   │   ├── verification.agent.ts
│   │   ├── diagnosis.agent.ts
│   │   ├── optimization.agent.ts
│   │   ├── governance.agent.ts
│   │   ├── pullrequest.agent.ts
│   │   └── sarvam.agent.ts
│   │
│   ├── lib/                          # Shared utilities
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   ├── server.ts
│   │   │   └── middleware.ts
│   │   ├── github/
│   │   │   ├── client.ts
│   │   │   ├── repos.ts
│   │   │   ├── commits.ts
│   │   │   ├── diffs.ts
│   │   │   └── pullrequests.ts
│   │   ├── groq/
│   │   │   └── client.ts
│   │   ├── sarvam/
│   │   │   └── client.ts
│   │   ├── accessibility/
│   │   │   ├── axe.ts
│   │   │   ├── lighthouse.ts
│   │   │   └── rules.ts
│   │   └── utils/
│   │       ├── diff.ts
│   │       ├── scoring.ts
│   │       └── formatting.ts
│   │
│   ├── hooks/                        # React hooks
│   │   ├── useAuth.ts
│   │   ├── usePipeline.ts
│   │   ├── useSSE.ts
│   │   └── useAssistant.ts
│   │
│   ├── types/                        # TypeScript type definitions
│   │   ├── database.ts
│   │   ├── agents.ts
│   │   ├── accessibility.ts
│   │   ├── github.ts
│   │   └── pipeline.ts
│   │
│   └── styles/                       # Design system
│       ├── tokens.css                # CSS custom properties
│       ├── typography.css
│       ├── animations.css
│       └── reset.css
│
├── public/
│   ├── fonts/
│   └── icons/
│
├── supabase/
│   ├── migrations/                   # Database migrations
│   └── seed.sql
│
├── .github/
│   └── workflows/
│       └── accessdiff.yml            # GitHub Actions template
│
├── next.config.js
├── tsconfig.json
├── package.json
└── .env.local.example
```

---

## 5. API Contract Overview

### 5.1 Authentication

```
POST /api/auth/github          → Initiate GitHub OAuth
GET  /api/auth/callback        → GitHub OAuth callback
POST /api/auth/logout          → Logout
GET  /api/auth/session         → Get current session
```

### 5.2 Repositories

```
GET  /api/repos                → List user's GitHub repositories
POST /api/repos/import         → Import a repository for monitoring
GET  /api/repos/:id            → Get repository details + AI summary
GET  /api/repos/:id/commits    → List commits
GET  /api/repos/:id/tree       → Get file tree
GET  /api/repos/:id/file       → Get file content
```

### 5.3 Pipeline

```
POST /api/pipeline/start       → Start accessibility pipeline for a commit range
GET  /api/pipeline/:id         → Get pipeline status
GET  /api/pipeline/:id/stream  → SSE stream for real-time progress
GET  /api/pipeline/:id/results → Get pipeline results
POST /api/pipeline/:id/approve → Approve a fix
POST /api/pipeline/:id/reject  → Reject a fix
POST /api/pipeline/:id/rollback → Rollback a fix
```

### 5.4 Issues

```
GET  /api/issues               → List issues (filterable)
GET  /api/issues/:id           → Get issue detail
```

### 5.5 Governance

```
GET  /api/governance           → List governance logs
GET  /api/governance/:id       → Get governance detail
```

### 5.6 Assistant

```
POST /api/assistant/chat       → Send text message, get response
POST /api/assistant/voice      → Send audio, get audio response
```

### 5.7 Pull Requests

```
POST /api/pullrequests/create  → Create GitHub PR from approved fixes
GET  /api/pullrequests         → List created PRs
```

### 5.8 Timeline

```
GET  /api/timeline/:repoId    → Get accessibility score timeline
```

---

## 6. Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# GitHub OAuth
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# Groq
GROQ_API_KEY=

# Sarvam AI
SARVAM_API_KEY=

# Mutagent
MUTAGENT_API_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 7. Deployment

### Target: Vercel

| Concern | Solution |
|---|---|
| Frontend | Vercel Edge Network (automatic) |
| API Routes | Vercel Serverless Functions |
| Long-running pipelines | Vercel Background Functions (or Inngest) |
| Database | Supabase (external) |
| CI/CD | Vercel Git Integration |

### Considerations

- Playwright and Lighthouse require headful browser — these should run as **background functions** or a **dedicated worker** (Vercel cron / external service).
- For the hackathon demo, Playwright/Lighthouse can run locally as part of the dev server.

---

## 8. Security

| Concern | Implementation |
|---|---|
| Authentication | Supabase Auth with GitHub OAuth (PKCE flow) |
| Authorization | Row Level Security on all Supabase tables |
| API Keys | Server-side only, never exposed to client |
| CSRF | SameSite cookies + Supabase session tokens |
| Input Validation | Zod schemas on all API inputs |
| Rate Limiting | Per-user rate limits on AI endpoints |
| Secrets | Environment variables, never committed |

---

*Document Version: 1.0*
*Last Updated: 2026-08-04*
*Status: DRAFT — Awaiting Review*
