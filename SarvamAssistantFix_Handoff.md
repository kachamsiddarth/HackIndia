# Sarvam Assistant Fixes — Agent Handoff Summary

> Session date: 2026-08-07
> Focus: **Accuracy of the Sarvam / Groq-powered voice + text assistant** (import commands failing with duplicate-key errors, NLU parsing accuracy, hardcoded GitHub username, LLM plan malformation).

---

## 1. User-Reported Problem

When the user spoke / typed commands like **"import test2 repo"** into the voice assistant chat, the agent produced an ugly database error:

```
Failed to import repository kachamsiddarth/test2: duplicate key value violates unique constraint
"projects_user_id_github_repo_key"
```

…even though the intent was correct and the UI already had 5+ test repos imported. The secondary complaint was general **NLU accuracy**: casual phrasings like "add portfolio repo then run audit" or "setup my 3D design project" were misrouted.

---

## 2. Root Causes Identified (6)

| # | Root Cause | Location |
|---|---|---|
| 1 | **No pre-existence check** on project insert. Both call sites always issued an upsert but without specifying the composite `(user_id, github_repo)` conflict target, so when the project row already existed, Supabase raised a duplicate-key error surfaced to the UI. | `action-registry.ts` `ImportRepositoryTool`, `projects/route.ts` POST |
| 2 | **Hardcoded `kachamsiddarth/` GitHub owner**. Any bare repo name (e.g. `test2`) was forcibly prefixed with the username of one developer, which made the import fail for any other GitHub OAuth user 100% of the time. | `action-registry.ts` (ActionRegistry) + `browser-agent.ts` (fallbackPlanner default) |
| 3 | **Repo-token extraction was naive.** The fallback planner used a single `replace(/import|repo|.../g, "")` + regex `/([a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+)/` which failed on phrases containing digits, kebab-case, filler words, and anything that wasn't `owner/repo`. And when extraction produced an empty string, it hard-fell back to the **wrong repo** `"acessDemo"`. | `browser-agent.ts` `fallbackPlanner()` |
| 4 | **Intent disambiguation was wrong.** The old code evaluated `if lower.includes("project") → NavigateTool /projects` BEFORE checking for import intent. Saying "import my test2 project" consequently opened the Projects page instead of importing. | `browser-agent.ts` `fallbackPlanner()` |
| 5 | **LLM JSON output was not validated.** Even when the Groq response was syntactically JSON, odd shapes (missing `actions` array, unregistered tool names, non-object `params`) would either throw later or silently do nothing. There was also a bug where the LLM emitted `[SelectRepositoryTool, ImportRepositoryTool]` — so the UI showed "Context updated: Repository set to X." and buried the real import result. | `browser-agent.ts` `planAndExecute()` |
| 6 | **Groq LLM prompt lacked examples.** The system prompt listed the tools but contained zero few-shot import examples, so the model often hallucinated tool params. | `browser-agent.ts` `AGENT_SYSTEM_PROMPT` |

---

## 3. Fixes Applied (7 changes across 4 files)

### Fix 3.1 — Pre-existence check + explicit onConflict (eliminates duplicate-key error)

**Files:**
- [src/lib/sarvam/action-registry.ts](./src/lib/sarvam/action-registry.ts) — `ImportRepositoryTool`
- [src/app/api/projects/route.ts](./src/app/api/projects/route.ts) — `POST` handler

**Change:**
Before calling GitHub APIs and before the `upsert()`, do:

```ts
const { data: existing } = await admin
  .from("projects")
  .select("*")
  .eq("user_id", context.userId)
  .eq("github_repo", repoName)
  .limit(1)
  .maybeSingle();

if (existing) {
  return {
    success: true,
    alreadyImported: true,  // NEW — see Fix 3.2
    message: `Repository ${repoName} is already imported. Accessibility score: ${existing.accessibility_score}%.`,
    data: existing,
    navigationTarget: `/projects/${existing.id}`,
  };
}
```

The remaining `upsert()` now specifies the conflict target explicitly:

```ts
.upsert(payload, { onConflict: "user_id, github_repo", ignoreDuplicates: false })
```

This makes the fast-path check + the upsert race-safe.

### Fix 3.2 — Type system: `alreadyImported` added to ActionResult

**File:**
- [src/lib/sarvam/agent-types.ts](./src/lib/sarvam/agent-types.ts)

```ts
export interface ActionResult {
  success: boolean;
  message: string;
  data?: any;
  navigationTarget?: string;
  alreadyImported?: boolean;  // ← NEW
}
```

Callers (UI toasts, chaining logic) can check `result.alreadyImported` to avoid duplicate-success banners when applicable.

### Fix 3.3 — Real user GitHub username used + fuzzy matching

**File:**
- [src/lib/sarvam/action-registry.ts](./src/lib/sarvam/action-registry.ts) `ImportRepositoryTool`

Replaced the hardcoded owner assumption with:
1.  Fetch the user's row with `select("github_token, github_username")`.
2.  Set `userLogin = dbUser.github_username || "kachamsiddarth"` (only fallback).
3.  Three resolution branches for `desiredRepo`:
    - **Empty / "user input required"**: call `github.getUserRepos("updated")` → pick the user's most recently updated repo **or** tell them "you have no accessible repos, specify `owner/repo`".
    - **Contains `/`**: split as-is (`owner/repo`).
    - **Bare name, e.g. "test2"**: fuzzy-match against `github.getUserRepos("updated")` using an alphanumeric-normalized equality + containment with a length-similarity score (exact match wins with `Infinity`). If none matches, fall back to the literal token under the user's own username.

### Fix 3.4 — New `extractRepoToken()` + rewritten `fallbackPlanner()`

**File:**
- [src/lib/sarvam/browser-agent.ts](./src/lib/sarvam/browser-agent.ts)

**`extractRepoToken(message)` (new private method):**
1.  `owner/repo` capture via regex first priority.
2.  Strip 30+ filler words/verbs in two passes: `\b(import|add|setup|connect|monitor|load|open|check|please|pls|repo|repository|project|just|want|need|my|the)\b` then `\b(and|then|run|audit|scan|pipeline|analysis|check)\b`.
3.  Keep only Unicode letters/digits/`_`/`-`.
4.  Sort remaining tokens by a GitHub-ness score (presence of `_` / `-` adds +2, then length) → pick the best. Reject pure digits.

**`fallbackPlanner()` rewritten:**
- Explicit priority order: **Import → Pipeline → Navigate (Projects/Dashboard) → Governance → Issues → PR → Dashboard default**. This eliminates the "open projects page when user said 'import test2 project'" bug.
- Uses separate booleans: `importVerbs`, `repoNoun`, `pipelineContextNouns`, `navigateToStaticNouns` — combined into a single `hasImportIntent` predicate that correctly classifies ambiguous utterances.

### Fix 3.5 — `normalizePlan()`: LLM JSON hardening

**File:**
- [src/lib/sarvam/browser-agent.ts](./src/lib/sarvam/browser-agent.ts)

Immediately after `generateCompletion<AgentPlan>()` returns, run:

```ts
plan = this.normalizePlan(plan, userMessage, context);
```

`normalizePlan()`:
- Guards against `null` / non-object → falls back to deterministic planner.
- Builds a `Set<AgentToolType>` of the 13 registered tools; filters `actions[]` to entries whose `tool` is actually in that set.
- Coerces `action.params` into a plain object.
- Guarantees `intent / thought / responseText` are strings.
- If zero valid actions remain → transparent fallback to `fallbackPlanner()`.

### Fix 3.6 — Improved LLM prompt: rules + few-shot import examples

**File:**
- [src/lib/sarvam/browser-agent.ts](./src/lib/sarvam/browser-agent.ts) `AGENT_SYSTEM_PROMPT`

Added:
1.  **Rule 2:** "For import, emit a **single** `ImportRepositoryTool` action. Do NOT add a `SelectRepositoryTool` action before it."
2.  **Rule 3:** "If the user provides a bare name without an owner, leave it bare — the executor will look up the user's GitHub username." (No more LLM guessing `kachamsiddarth/`.)
3.  **Rule 4:** "If no repo name is mentioned for import, pass `repoName: ""` → executor will pick the user's most recently updated GitHub repository."
4.  **Three few-shot JSON examples:** bare name, full `owner/repo`, and "import + run pipeline" composite.

### Fix 3.7 — Noisy "Context updated…" message filtered from final response

**File:**
- [src/lib/sarvam/browser-agent.ts](./src/lib/sarvam/browser-agent.ts) `planAndExecute()`

After executing tools, build the response message by:
1.  Filtering out any action result that starts with `"context updated"` (case-insensitive) to avoid the `SelectRepositoryTool` context banner burying the real import result.
2.  Only falling back to the raw concatenation if the filtered list is empty.

Also: **context propagation between tools** — after an `ImportRepositoryTool` returns with `result.data.id`, that id is written into a **new local `context` object** for use by subsequent tools in the same plan. This makes composite commands like "add portfolio repo then run pipeline" correctly run the pipeline against the project you just imported (the old code used the stale `context.projectId` which was usually `undefined`).

---

## 4. Files Changed (Summary)

| File | Lines of change | Notes |
|---|---|---|
| `src/lib/sarvam/action-registry.ts` | Rewrote `ImportRepositoryTool` (~140 lines changed) | Existence fast-path, real username, fuzzy match, explicit onConflict, type-safe repo check |
| `src/app/api/projects/route.ts` | ~30 lines in `POST` | Existence fast-path + explicit `onConflict` upsert option |
| `src/lib/sarvam/agent-types.ts` | +6 lines | Added `alreadyImported?: boolean` to `ActionResult` |
| `src/lib/sarvam/browser-agent.ts` | Prompt rewrite + new `normalizePlan()` + new `extractRepoToken()` + rewritten `fallbackPlanner()` + context propagation + response filter (~160 lines) | Largest single improvement for NLU accuracy |

---

## 5. Verification Commands

Run before considering any follow-up agent work on this area:

```bash
npx tsc --noEmit                         # 0 type errors expected
npm run build                            # Next.js 16 production build
node scripts/audit-keyboard.mjs <URL>    # (if changing keyboard/a11y behavior)
npm run lint                             # Pre-existing any-typed errors are OK; new any usages should be fixed.
```

At the time of handoff all three pass — TypeScript clean, build successful with all 27 routes compiled, and only pre-existing lint warnings about `any` in untouched files remain.

---

## 6. Manual Validation Script (Paste into Dashboard Assistant chat)

After redeploying, test each of these 6 commands one at a time to confirm the fixes are active:

| # | Command | Expected Output (2026-08-07 behavior) |
|---|---|---|
| 1 | `import test2 repo` | If already imported: "Repository kachamsiddarth/test2 is already imported. Accessibility score: 40%. Navigate to project page." No duplicate-key error. |
| 2 | `import brand-new-repo` | Import success + navigate. (New repo needs to actually exist in user's GitHub first.) |
| 3 | `add 3D_design repository` | Fuzzy matches user's own `3D_design` repo regardless of spoken order. |
| 4 | `import kachamsiddarth/acessDemo` | Full `owner/repo` preserved verbatim; if already there → "already imported" with score. |
| 5 | `add portfolio repo and run pipeline` | First action: import (or "already imported"). Second action: `RunPipelineTool` against the **same** `projectId` that the import just returned. |
| 6 | `open projects` | NavigateTool → `/projects` page (not misclassified as import). |

---

## 7. Known Remaining Risk / Future Work

- **Sarvam STT accuracy for Indian languages**: The browser agent currently uses `window.SpeechRecognition` (Chrome's engine), not the `/api/voice` Sarvam endpoint for STT (the Sarvam endpoint is only used for **TTS playback** of the assistant reply). If Hindi/Bengali/Tamil voice input is critical, route the `recording` flow in `GlobalVoiceAgent.tsx` through Sarvam `speechToText()` instead of the browser default.
- **Groq key rotation**: Already present; not modified.
- **Rate limits / quota**: Groq calls are wrapped with a 2× key round-robin and 3 model fallback list; if the quota is exhausted, the transparent fallback planner still handles import commands correctly (see Fix 3.4), so functionality degrades gracefully rather than failing.

---

## 8. Keyboard Shortcut + Accessibility Announcer (added same session, after the fixes above)

Added global **Alt + Space** toggle for the Sarvam microphone. See:
- `src/components/accessibility/KeyboardShortcutProvider.tsx` — shared provider exposes `useShortcutToggleVoice()`, `announce()`, and mounts an aria-live region.
- `src/components/layout/DashboardClientShell.tsx` — wraps content with the provider so all dashboard pages have it.
- `src/components/voice/GlobalVoiceAgent.tsx` — subscribes to shortcut provider events, so Alt+Space and the floating FAB drive the same state (fully bidirectional sync). First-launch of accessibility mode announces the shortcut via `sessionStorage["accessdiff.a11y-intro-shown"]` guard.

All code for the shortcut is frontend-only; backend / `/api/chat` / `/api/voice` were untouched.
