# AccessDiff — Development Rules

> Coding standards, conventions, and non-negotiable development rules

---

## 1. Architecture Rules

### R-001: No Placeholder Implementations

Every function, API route, and component must contain real, working logic. Never use:
- `// TODO: implement`
- `return null` as a placeholder
- Fake/mock API responses disguised as real ones
- Hard-coded data pretending to be dynamic

### R-002: Single Responsibility

Every file, function, component, and agent has ONE job. If you can't describe what it does in one sentence, split it.

### R-003: Phase Sequential Execution

Complete Phase N before starting Phase N+1. No exceptions. Each phase must be:
1. Fully implemented
2. Verified (builds, renders, functions correctly)
3. Documented (Tracker.md and Memory.md updated)

### R-004: No Architectural Contradictions

Every decision must be consistent with the documentation:
- PRD.md for feature requirements
- TRD.md for technology choices
- Schema.md for database structure
- Design.md for visual specifications
- AppFlow.md for user journeys

If a contradiction is discovered, update the documentation FIRST, then update the implementation.

### R-005: Documentation is Truth

If the code disagrees with the documentation, the code is wrong (assuming the docs haven't been intentionally updated).

---

## 2. TypeScript Rules

### R-010: Strict TypeScript

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### R-011: No `any`

Never use `any`. Use `unknown` when the type is truly unknown, then narrow with type guards.

### R-012: Explicit Return Types

All exported functions must have explicit return types.

```typescript
// ✅ Good
export function calculateScore(issues: Issue[]): number { ... }

// ❌ Bad
export function calculateScore(issues: Issue[]) { ... }
```

### R-013: Type Definitions in `/types`

All shared types live in `src/types/`. Component-specific types can be co-located.

### R-014: Enums Over String Literals (for DB types)

Use TypeScript enums or const objects that mirror the database enums.

```typescript
// ✅ Good
export const IssueSeverity = {
  CRITICAL: 'critical',
  MAJOR: 'major',
  MINOR: 'minor',
  ADVISORY: 'advisory',
} as const;

export type IssueSeverity = typeof IssueSeverity[keyof typeof IssueSeverity];
```

---

## 3. React / Next.js Rules

### R-020: Server Components by Default

Use React Server Components unless the component needs:
- `useState` or `useEffect`
- Browser APIs
- Event handlers
- Client-side libraries (GSAP, Recharts, Monaco)

Mark client components explicitly with `'use client'`.

### R-021: Component File Structure

```
ComponentName/
├── ComponentName.tsx       # Component logic
├── ComponentName.module.css # Styles (CSS Module)
└── index.ts               # Re-export
```

### R-022: No Inline Styles

Use CSS Modules or CSS custom properties. Never use `style={{}}` except for truly dynamic values (e.g., calculated widths).

### R-023: Accessible Components

Every component must:
- Have proper ARIA attributes where needed
- Be keyboard navigable
- Have visible focus indicators
- Use semantic HTML elements
- Include `aria-label` on icon-only buttons

### R-024: Error Boundaries

Every page-level component must be wrapped in an error boundary.

### R-025: Loading States

Every data-fetching component must show a loading state (Skeleton component).

### R-026: No Props Drilling Beyond 2 Levels

If props need to pass through more than 2 component levels, use React Context or restructure.

---

## 4. CSS Rules

### R-030: CSS Modules Only

All component styles use CSS Modules (`.module.css`). Global styles only in `globals.css` and design system files.

### R-031: CSS Custom Properties for Theming

All colors, spacing, and typography values must reference CSS custom properties defined in `tokens.css`.

```css
/* ✅ Good */
.card {
  background: var(--color-bg-surface);
  padding: var(--space-4);
  border-radius: var(--radius-lg);
}

/* ❌ Bad */
.card {
  background: #131520;
  padding: 16px;
  border-radius: 12px;
}
```

### R-032: No Magic Numbers

Every numeric value should be a token or documented with a comment explaining why it's that specific value.

### R-033: Mobile-First Media Queries

```css
/* Base styles = mobile */
.container { padding: var(--space-4); }

/* Then scale up */
@media (min-width: 768px) {
  .container { padding: var(--space-6); }
}
```

---

## 5. API Rules

### R-040: Consistent Response Format

All API routes return this shape:

```typescript
// Success
{ data: T, error: null }

// Error
{ data: null, error: { message: string, code: string } }
```

### R-041: Input Validation

All API inputs validated with Zod schemas before processing.

```typescript
const schema = z.object({
  repoFullName: z.string().regex(/^[a-zA-Z0-9-]+\/[a-zA-Z0-9-_.]+$/),
});
```

### R-042: Error Handling

Never return raw error objects. Always return human-readable error messages with appropriate HTTP status codes.

### R-043: Auth Check on Every Route

Every API route (except auth routes) must verify the Supabase session.

---

## 6. Agent Rules

### R-050: One Agent, One Responsibility

Each agent file does exactly one thing. `AccessibilityAnalysisAgent` does NOT generate fixes. `AccessibilityFixAgent` does NOT explain issues.

### R-051: Structured Output

Every agent returns a typed output object, never raw strings.

```typescript
interface AgentOutput<T> {
  success: boolean;
  data: T;
  confidence: number;
  reasoning: string;
  duration_ms: number;
}
```

### R-052: Prompt Engineering Standards

- System prompts are stored as constants, not inline strings
- Prompts include output format instructions (JSON schema)
- Prompts include examples where helpful
- Prompts are versioned (comment with version number)

### R-053: Governance Logging

Every agent decision MUST create a governance log entry. No exceptions.

### R-054: Graceful Failure

If an agent fails, it returns a structured error, not an exception. The Helix orchestrator decides how to handle the failure.

---

## 7. Database Rules

### R-060: RLS Always Enabled

Every table has Row Level Security enabled with appropriate policies.

### R-061: Migrations Only

Never modify the database schema directly. Always use migration files.

### R-062: Use Service Role Key Server-Side Only

The `SUPABASE_SERVICE_ROLE_KEY` is NEVER used in client-side code or exposed to the browser.

### R-063: Indexed Queries

Every `WHERE` clause column must have an index. Check `Schema.md` for existing indexes before adding queries.

---

## 8. Git Rules

### R-070: Conventional Commits

```
feat: add pipeline SSE streaming
fix: correct trust score calculation
docs: update Schema.md with new index
style: refactor card hover animation
refactor: extract agent base class
chore: update dependencies
```

### R-071: One Feature Per Commit

Each commit should represent one logical change.

### R-072: No Secrets in Git

`.env.local` is in `.gitignore`. Always use `.env.local.example` for documentation.

---

## 9. Performance Rules

### R-080: Lazy Load Heavy Components

Monaco Editor, Recharts, and GSAP animations must be dynamically imported.

```typescript
const DiffViewer = dynamic(() => import('@/components/code/DiffViewer'), {
  loading: () => <Skeleton height={400} />,
  ssr: false,
});
```

### R-081: Optimize Images

Use `next/image` for all images. Provide width and height.

### R-082: Limit Bundle Size

No single page JS bundle should exceed 200KB gzipped.

---

## 10. Testing Rules

### R-090: Verify Each Phase

After each phase, verify:
1. `npm run build` succeeds (zero errors)
2. `npm run dev` renders correctly
3. All new features work as specified
4. No regressions in previous features

### R-091: Manual Accessibility Testing

After Phases 2, 6, 9, and 14:
1. Tab through all interactive elements
2. Check focus visibility
3. Verify screen reader output (where possible)

---

## 11. Naming Conventions

| Entity | Convention | Example |
|---|---|---|
| Files (components) | PascalCase | `PipelineView.tsx` |
| Files (utilities) | camelCase | `scoring.ts` |
| Files (agents) | camelCase.agent | `repository.agent.ts` |
| CSS Modules | PascalCase.module | `PipelineView.module.css` |
| Components | PascalCase | `<PipelineView />` |
| Functions | camelCase | `calculateTrustScore()` |
| Constants | SCREAMING_SNAKE | `MAX_VERIFICATION_ITERATIONS` |
| Types/Interfaces | PascalCase | `PipelineRun` |
| CSS classes | camelCase | `.stageCard` |
| CSS variables | kebab-case | `--color-bg-surface` |
| API routes | kebab-case | `/api/pipeline/start` |
| Database tables | snake_case | `pipeline_runs` |
| Database columns | snake_case | `trust_score` |
| Environment vars | SCREAMING_SNAKE | `GROQ_API_KEY` |

---

## 12. UI & Aesthetic Taste (Emil Kowalski Guidelines)

Follow the impeccable taste of Emil Kowalski for all frontend craftsmanship:
- **Animations:** Must be purposeful, buttery smooth, and never blocking. Use spring physics for micro-interactions.
- **Glassmorphism:** Use tastefully with subtle borders and blurred backdrops.
- **Minimalism:** Remove borders where shadows or spacing suffice. Let the content breathe.
- **Micro-interactions:** Every hover, active, and focus state must feel tactile and instantly responsive.

## 13. AI Agent Architecture (Matt Pocock Skills Model)

Based on the cloned `skills` repository architecture:
- **Skill Buckets:** Organize agents/skills logically (e.g., `engineering/`).
- **Standardized Specs:** Every skill must have a `SKILL.md` defining its inputs, outputs, and constraints.
- **Modularity:** Treat each skill as a standalone composable unit.
- **Codebase Memory Pattern:** Use `Memory.md` as a living architectural memory graph rather than relying on blind file-by-file RAG to save tokens and improve context accuracy.

## 14. Non-Negotiable Principles

1. **Every AI decision is logged.** No silent AI actions.
2. **Every AI fix is verified.** No assumed correctness.
3. **Every AI suggestion has a trust score.** No blind trust.
4. **Every modification is reversible.** No permanent AI changes.
5. **The platform itself is accessible.** No "do as I say, not as I do."
6. **Documentation precedes implementation.** No code without context.
7. **Phases are sequential.** No jumping ahead.

---

*Document Version: 1.0*
*Last Updated: 2026-08-04*
*Status: DRAFT — Awaiting Review*
