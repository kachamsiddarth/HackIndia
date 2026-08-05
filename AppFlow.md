# AccessDiff — Application Flow

> Complete user journey and system interaction diagrams

---

## 1. High-Level User Flow

```mermaid
flowchart TD
    A["🔐 GitHub Login"] --> B["📦 Repository Import"]
    B --> C["🧠 Repository Understanding"]
    C --> D["🔍 Git Diff Analysis"]
    D --> E["♿ Accessibility Detection"]
    E --> F["💡 AI Explanation"]
    F --> G["⚠️ Risk Classification"]
    G --> H["🔧 AI Fix Generation"]
    H --> I["✅ Continuous Verification"]
    I --> J["📊 Before / After Comparison"]
    J --> K["📄 Technical Summary"]
    K --> L["🔀 Create Pull Request"]
    L --> M["🛡 Governance Logging"]
    M --> N["📈 Accessibility Timeline"]

    style A fill:#1a1a2e,stroke:#f97316,color:#fff
    style B fill:#1a1a2e,stroke:#f97316,color:#fff
    style C fill:#1a1a2e,stroke:#f97316,color:#fff
    style D fill:#1a1a2e,stroke:#f97316,color:#fff
    style E fill:#1a1a2e,stroke:#f97316,color:#fff
    style F fill:#1a1a2e,stroke:#f97316,color:#fff
    style G fill:#1a1a2e,stroke:#f97316,color:#fff
    style H fill:#1a1a2e,stroke:#f97316,color:#fff
    style I fill:#1a1a2e,stroke:#f97316,color:#fff
    style J fill:#1a1a2e,stroke:#f97316,color:#fff
    style K fill:#1a1a2e,stroke:#f97316,color:#fff
    style L fill:#1a1a2e,stroke:#f97316,color:#fff
    style M fill:#1a1a2e,stroke:#f97316,color:#fff
    style N fill:#1a1a2e,stroke:#f97316,color:#fff
```

This pipeline is presented as **ONE continuous flow** in the frontend. Each stage is an expandable card that shows detailed information as it completes. Users always know which stage is currently active.

---

## 2. Detailed Flow: Authentication & Onboarding

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as API Route
    participant S as Supabase Auth
    participant G as GitHub

    U->>F: Click "Sign in with GitHub"
    F->>S: signInWithOAuth(provider: 'github')
    S->>G: Redirect to GitHub OAuth
    G->>U: Authorize AccessDiff?
    U->>G: Approve
    G->>S: Authorization code
    S->>S: Exchange for access token
    S->>F: Redirect to /callback with session
    F->>A: GET /api/auth/session
    A->>S: Verify session
    S-->>A: User + GitHub token
    A-->>F: Authenticated session
    F->>U: Redirect to Dashboard
```

### Post-Auth State

After authentication, the system stores:
- Supabase session (cookie-based)
- GitHub OAuth token (encrypted in Supabase `users` table)
- User profile (avatar, name, GitHub username)

---

## 3. Detailed Flow: Repository Import

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as API
    participant GH as GitHub API
    participant DB as Supabase

    U->>F: Navigate to Dashboard
    F->>A: GET /api/repos
    A->>GH: List user repositories
    GH-->>A: Repository list
    A-->>F: Display repositories

    U->>F: Select repository → Click "Import"
    F->>A: POST /api/repos/import
    A->>DB: Create project record
    A->>GH: Get repo metadata (languages, size, default branch)
    GH-->>A: Metadata
    A->>DB: Update project with metadata
    A-->>F: Project created
    F->>U: Redirect to project page
```

---

## 4. Detailed Flow: Accessibility Pipeline

This is the core workflow. It maps directly to the Mutagent Helix ADL lifecycle.

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant API as API Route
    participant H as Helix Orchestrator
    participant RA as RepositoryAgent
    participant GDA as GitDiffAgent
    participant AAA as AccessibilityAnalysisAgent
    participant AEA as AccessibilityExplanationAgent
    participant AFA as AccessibilityFixAgent
    participant VA as VerificationAgent
    participant DA as DiagnosisAgent
    participant OA as OptimizationAgent
    participant GA as GovernanceAgent
    participant PRA as PullRequestAgent
    participant DB as Supabase

    U->>F: Select commit range → "Run Analysis"
    F->>API: POST /api/pipeline/start
    API->>DB: Create pipeline record (status: running)
    API->>H: Start Helix Pipeline

    Note over H: ══ SPEC STAGE ══
    H->>RA: Understand repository
    RA-->>H: Project summary, framework, risk areas
    H->>GDA: Compare commits
    GDA-->>H: Changed files, diffs
    H->>F: SSE: stage=spec, status=complete

    Note over H: ══ BUILD STAGE ══
    H->>AAA: Analyze changed files
    AAA-->>H: Raw accessibility issues (axe-core + AI)
    H->>AEA: Explain each issue
    AEA-->>H: Enriched issues with explanations
    H->>AFA: Generate fixes for each issue
    AFA-->>H: Fix diffs
    H->>F: SSE: stage=build, status=complete

    Note over H: ══ EVALUATE STAGE ══
    H->>VA: Verify each fix
    VA-->>H: Verification results

    alt All fixes pass
        H->>F: SSE: stage=evaluate, status=pass
    else Some fixes fail
        H->>F: SSE: stage=evaluate, status=partial

        Note over H: ══ DIAGNOSE STAGE ══
        H->>DA: Root cause analysis on failed fixes
        DA-->>H: Failure reasons
        H->>F: SSE: stage=diagnose, status=complete

        Note over H: ══ OPTIMIZE STAGE ══
        H->>OA: Improve failed fixes
        OA-->>H: Improved fix diffs
        H->>VA: Re-verify improved fixes
        VA-->>H: Re-verification results
        H->>F: SSE: stage=optimize, status=complete
    end

    Note over H: ══ POST-PIPELINE ══
    H->>GA: Log all decisions
    GA-->>DB: Governance records
    H->>DB: Store pipeline results
    H->>F: SSE: stage=complete, results=...
    F->>U: Display complete pipeline with results

    U->>F: Review fixes → "Create Pull Request"
    F->>API: POST /api/pullrequests/create
    API->>PRA: Generate PR
    PRA-->>API: PR created on GitHub
    API-->>F: PR URL
    F->>U: Show PR link
```

---

## 5. Detailed Flow: Verification Loop

```mermaid
flowchart TD
    A["AI Fix Generated"] --> B["Run Verification"]
    B --> C{Fix Passes?}
    C -->|Yes| D["✅ Mark as Verified"]
    C -->|No| E{Iteration < 3?}
    E -->|Yes| F["🔍 Diagnose Failure"]
    F --> G["⚡ Optimize Fix"]
    G --> B
    E -->|No| H["⚠️ Mark as Unresolved"]
    H --> I["Flag for Manual Review"]

    style D fill:#22c55e,stroke:#16a34a,color:#fff
    style H fill:#ef4444,stroke:#dc2626,color:#fff
```

---

## 6. Page-by-Page Application Flow

### 6.1 Landing Page (`/`)

```
┌─────────────────────────────────────────────────────┐
│  AccessDiff                              [Sign In]  │
│─────────────────────────────────────────────────────│
│                                                      │
│     AI Accessibility Copilot for GitHub              │
│                                                      │
│     [Get Started with GitHub →]                      │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │Regression│  │AI Fixes  │  │Governance│          │
│  │Detection │  │& Verify  │  │& Trust   │          │
│  └──────────┘  └──────────┘  └──────────┘          │
│                                                      │
│  [Pipeline Demo Animation]                           │
│                                                      │
└─────────────────────────────────────────────────────┘
```

- Hero section with product tagline
- Feature cards with animations
- Live demo preview of the pipeline
- CTA: Sign in with GitHub

### 6.2 Dashboard (`/dashboard`)

```
┌──────┬──────────────────────────────────────────────┐
│      │  Dashboard                           [user]  │
│  S   │──────────────────────────────────────────────│
│  I   │                                              │
│  D   │  Your Projects                               │
│  E   │  ┌────────────────────────────────────────┐  │
│  B   │  │ repo-name          Score: 87    [View] │  │
│  A   │  │ Last scan: 2h ago  Issues: 3           │  │
│  R   │  └────────────────────────────────────────┘  │
│      │  ┌────────────────────────────────────────┐  │
│      │  │ another-repo       Score: 92    [View] │  │
│      │  │ Last scan: 1d ago  Issues: 1           │  │
│      │  └────────────────────────────────────────┘  │
│      │                                              │
│      │  [+ Import Repository]                       │
│      │                                              │
└──────┴──────────────────────────────────────────────┘
```

- Sidebar navigation (persistent)
- Project cards with accessibility scores
- Quick stats (total issues, improvement trend)
- Import new repository button

### 6.3 Project Pipeline (`/project/[id]/pipeline`)

```
┌──────┬──────────────────────────────────────────────┐
│      │  project-name / Pipeline             [user]  │
│  S   │──────────────────────────────────────────────│
│  I   │  Commit: abc123 → def456                     │
│  D   │                                              │
│  E   │  ┌─ ✅ Repository Understanding ──────────┐  │
│  B   │  │  Framework: Next.js 14                  │  │
│  A   │  │  Components: 47  Forms: 12  Pages: 8    │  │
│  R   │  │  Risk Areas: Navigation, Forms, Modal   │  │
│      │  └─────────────────────────────────────────┘  │
│      │                                              │
│      │  ┌─ ✅ Git Diff Analysis ─────────────────┐  │
│      │  │  Files Changed: 5                       │  │
│      │  │  A11y-Relevant: 3                       │  │
│      │  └─────────────────────────────────────────┘  │
│      │                                              │
│      │  ┌─ 🔄 Accessibility Detection ───────────┐  │
│      │  │  ████████░░ 80%                         │  │
│      │  │  Scanning: src/components/Modal.tsx      │  │
│      │  └─────────────────────────────────────────┘  │
│      │                                              │
│      │  ┌─ ⏳ AI Explanation ────────────────────┐  │
│      │  │  Waiting...                             │  │
│      │  └─────────────────────────────────────────┘  │
│      │                                              │
│      │  ... (remaining stages)                      │
│      │                                              │
│      │  [💬 Ask AI Assistant]                       │
│      │                                              │
└──────┴──────────────────────────────────────────────┘
```

- Continuous vertical pipeline view
- Each stage is an expandable card
- Active stage shows progress bar and current activity
- Completed stages show summary results
- Pending stages show "Waiting..."
- Real-time updates via SSE

### 6.4 Repository Explorer (`/project/[id]/explorer`)

```
┌──────┬──────────────────────────────────────────────┐
│      │  project-name / Explorer             [user]  │
│  S   │──────────────────────────────────────────────│
│  I   │  ┌──────────┬───────────────────────────────┐│
│  D   │  │ 📁 src   │  // Modal.tsx                 ││
│  E   │  │  📁 comp │                               ││
│  B   │  │   📄 But │  export function Modal() {    ││
│  A   │  │   📄 Mod │    return (                   ││
│  R   │  │   📄 Nav │ ⚠  <div onClick={close}>     ││
│      │  │  📁 pages│        {children}              ││
│      │  │  📁 lib  │      </div>                   ││
│      │  │          │    );                          ││
│      │  │          │  }                             ││
│      │  │          │                               ││
│      │  │          │  ──────────────────────────── ││
│      │  │          │  ⚠ Line 5: div with onClick  ││
│      │  │          │  requires keyboard handler    ││
│      │  │          │  WCAG 2.1.1  Severity: Major ││
│      │  └──────────┴───────────────────────────────┘│
└──────┴──────────────────────────────────────────────┘
```

- Left panel: file tree with issue indicators
- Right panel: code viewer (Monaco Editor)
- Inline issue annotations on affected lines
- Issue detail panel below code

### 6.5 Issue Detail View

```
┌──────────────────────────────────────────────────────┐
│  Issue: Missing keyboard handler on interactive div  │
│──────────────────────────────────────────────────────│
│                                                      │
│  📍 File: src/components/Modal.tsx  Line: 5          │
│  ⚠️  Severity: Major    🎯 Confidence: 92%          │
│  📋 WCAG: 2.1.1 Keyboard                            │
│                                                      │
│  ┌─ Trust Score ─────────────────────────────────┐   │
│  │  Score: 88/100  ✅ Verified  🔄 Rollback      │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ┌─ Explanation ─────────────────────────────────┐   │
│  │  Technical: The <div> element uses onClick    │   │
│  │  but has no onKeyDown/onKeyUp handler...      │   │
│  │                                               │   │
│  │  Impact: Keyboard-only users cannot interact  │   │
│  │  with this modal close button...              │   │
│  │                                               │   │
│  │  Business: ~15% of users rely on keyboard     │   │
│  │  navigation. This blocks modal dismissal...   │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ┌─ Fix ──── Before ──── │ ──── After ────────────┐  │
│  │  - <div onClick={c}>  │ + <button onClick={c}> │  │
│  │  -   {children}       │ +   {children}         │  │
│  │  - </div>             │ + </button>            │  │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  [✅ Approve Fix]  [❌ Reject]  [🔄 Rollback]       │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 6.6 Governance Log (`/project/[id]/governance`)

```
┌──────┬──────────────────────────────────────────────┐
│      │  project-name / Governance           [user]  │
│  S   │──────────────────────────────────────────────│
│  I   │                                              │
│  D   │  AI Decision Audit Trail                     │
│  E   │                                              │
│  B   │  ┌────────────────────────────────────────┐  │
│  A   │  │ 🕐 12:34:05  AccessibilityFixAgent     │  │
│  R   │  │ Action: Generated fix for Modal.tsx:5   │  │
│      │  │ Confidence: 92%  Trust: 88              │  │
│      │  │ Reasoning: Interactive div → button     │  │
│      │  │ Verification: ✅ Passed                 │  │
│      │  │ Status: Approved by developer           │  │
│      │  │ [View Before] [View After] [Rollback]   │  │
│      │  └────────────────────────────────────────┘  │
│      │                                              │
│      │  ┌────────────────────────────────────────┐  │
│      │  │ 🕐 12:33:58  VerificationAgent         │  │
│      │  │ Action: Verified fix passes axe-core    │  │
│      │  │ Confidence: 95%  Trust: 91              │  │
│      │  │ ...                                     │  │
│      │  └────────────────────────────────────────┘  │
│      │                                              │
└──────┴──────────────────────────────────────────────┘
```

### 6.7 Accessibility Timeline (`/project/[id]/timeline`)

```
┌──────┬──────────────────────────────────────────────┐
│      │  project-name / Timeline             [user]  │
│  S   │──────────────────────────────────────────────│
│  I   │                                              │
│  D   │  Accessibility Score Over Time               │
│  E   │                                              │
│  B   │  100 ┤                          ╱──●         │
│  A   │   90 ┤              ╱──●───●──╱              │
│  R   │   80 ┤    ●───●──╱╱                          │
│      │   70 ┤  ╱                                    │
│      │   60 ┤╱                                      │
│      │      ├──┬──┬──┬──┬──┬──┬──┬──┬──             │
│      │      Jan  Feb  Mar  Apr  May  Jun             │
│      │                                              │
│      │  Recent Commits                              │
│      │  ┌──────────────────────────────────────┐    │
│      │  │ abc123  +3 issues  -5 issues  ↑ 92   │    │
│      │  │ def456  +1 issue   -2 issues  ↑ 87   │    │
│      │  └──────────────────────────────────────┘    │
│      │                                              │
└──────┴──────────────────────────────────────────────┘
```

---

## 7. Sarvam AI Assistant Flow

The assistant is a floating panel accessible from any page.

```mermaid
sequenceDiagram
    participant U as User
    participant Chat as Chat Panel
    participant API as /api/assistant
    participant S as Sarvam AI
    participant Ctx as Context Engine

    U->>Chat: "Explain this WCAG rule"
    Chat->>API: POST /api/assistant/chat
    API->>Ctx: Gather context (current issue, file, repo)
    Ctx-->>API: Context payload
    API->>S: Chat completion with context
    S-->>API: Response (text)
    API-->>Chat: Display response

    Note over U,Chat: Voice Mode
    U->>Chat: 🎤 Press microphone
    Chat->>API: POST /api/assistant/voice (audio blob)
    API->>S: Speech-to-Text
    S-->>API: Transcribed text
    API->>S: Chat completion
    S-->>API: Response text
    API->>S: Text-to-Speech
    S-->>API: Audio response
    API-->>Chat: Play audio + show text
```

### Contextual Awareness

The assistant knows:
- Which repository the user is viewing
- Which file is open
- Which issue is selected
- The current pipeline status
- The user's language preference

---

## 8. CI/CD Integration Flow

```mermaid
flowchart TD
    A["Developer pushes code"] --> B["GitHub Actions triggered"]
    B --> C["AccessDiff Action runs"]
    C --> D["Helix Pipeline starts"]
    D --> E["Accessibility Analysis"]
    E --> F{"Score above threshold?"}
    F -->|Yes| G["✅ PASS — Allow merge"]
    F -->|No| H["❌ FAIL — Block merge"]
    H --> I["Create issue comment with details"]

    style G fill:#22c55e,stroke:#16a34a,color:#fff
    style H fill:#ef4444,stroke:#dc2626,color:#fff
```

### GitHub Actions YAML (generated for users)

```yaml
name: AccessDiff Accessibility Check
on:
  pull_request:
    branches: [main]

jobs:
  accessibility:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run AccessDiff
        uses: accessdiff/action@v1
        with:
          api-key: ${{ secrets.ACCESSDIFF_API_KEY }}
          threshold: 80
          fail-on-regression: true
```

---

## 9. State Management

### Frontend State Architecture

```
Application State
├── Auth State (Supabase session — cookie-based)
├── Project State (selected project, repo data)
├── Pipeline State (SSE-driven, real-time updates)
│   ├── Current stage
│   ├── Stage results
│   ├── Issues found
│   └── Fixes generated
├── UI State (sidebar open, active tab, modals)
└── Assistant State (chat history, voice recording)
```

- **Auth:** Managed by Supabase client SDK (persisted in cookies)
- **Server Data:** Fetched via React Server Components where possible, or SWR/fetch for client components
- **Pipeline:** SSE-driven state via `useSSE` custom hook
- **UI:** React `useState` / `useReducer` (no global state library needed)

---

## 10. Error Handling Strategy

| Scenario | User Experience |
|---|---|
| GitHub API rate limit | "GitHub rate limit reached. Retry in X minutes." |
| Groq API timeout | "AI analysis taking longer than expected. Retrying..." |
| Pipeline stage failure | Stage card shows error with retry button |
| Network disconnect | Toast: "Connection lost. Reconnecting..." |
| Supabase auth expired | Redirect to login with "Session expired" message |
| Verification loop exhausted | "Fix could not be verified after 3 attempts. Flagged for manual review." |

---

*Document Version: 1.0*
*Last Updated: 2026-08-04*
*Status: DRAFT — Awaiting Review*
