---
name: mutagent-cli
description: |
  Mutagent CLI - the command-line client for the Mutagent platform.
  Guides coding agents through setup (login, init, providers, workspaces),
  installing Mutagent packages (helix, diagnostics, evaluator), and sending
  product feedback.
  Triggers: "mutagent", "mutagent cli", "mutagent login", "set up mutagent",
  "install diagnostics", "install evaluator", "install helix", "mutagent install",
  "send feedback", "mutagent feedback", "report a bug", "usage", "quota",
  "install skill", "install hooks".
license: MIT
metadata:
  skill_version: "1.2.0"
  skill_min_cli_version: "0.1.163"
---

# Mutagent CLI Skill

> **Canonical source**: `mutagent-cli/.claude/skills/mutagent-cli/SKILL.md`
> Packed into the CLI binary via `scripts/sync-skill.ts`. Installed to end-user
> dev environments via `mutagent skills install`. Edit this file, not the installed copy.

---

## CLI Prerequisite Check (RUN FIRST)

Before executing ANY workflow step, verify the CLI is installed and version-compatible:

**Step 1 -- Check CLI presence:**
```bash
mutagent --version --json
```

**Step 2 -- If command not found (error / not on PATH):**

This is the **Path 2 onboarding case**: the Skill was installed first (e.g. from a skill registry, manually, or bundled in someone else's CLAUDE.md), but the CLI itself isn't installed yet. Do NOT just dump install instructions and stop -- proactively **offer to install it**.

**2a. Detect the user's package manager** (best-effort — check in this order):
```bash
# In the user's project root (cwd):
test -f bun.lockb && echo "bun"
test -f pnpm-lock.yaml && echo "pnpm"
test -f yarn.lock && echo "yarn"
test -f package-lock.json && echo "npm"
# Fallback: which bun || which pnpm || which yarn || which npm
```
If multiple lockfiles exist, prefer in order: `bun > pnpm > yarn > npm`.
If no lockfile and the user is in a non-JS project (e.g. Python, Go), ask which they prefer.

**2b. Ask the user via AskUserQuestion** (do NOT auto-install without consent):

> "The Mutagent CLI is not installed yet. I can install it globally via `<detected-pm>`. Proceed?"

Options to present:
1. **Yes, install globally with `<detected-pm>`** (Recommended) -- runs `<pm> add -g @mutagent/cli` (or `npm install -g @mutagent/cli` for npm)
2. **Yes, but use a different package manager** -- prompt for choice (npm / bun / pnpm / yarn)
3. **No, I'll install it myself** -- show the four install commands as a verbatim block; STOP and wait for the user to install
4. **Skip — I have it installed via a different path** -- ask the user to add it to PATH and re-invoke

**2c. On user approval (option 1 or 2)**, run the install command in a Bash tool call:
```bash
# bun
bun add -g @mutagent/cli
# npm
npm install -g @mutagent/cli
# pnpm
pnpm add -g @mutagent/cli
# yarn
yarn global add @mutagent/cli
```
Show the install output to the user verbatim. After it completes, **re-run Step 1** (`mutagent --version --json`) to confirm the CLI is now on PATH. If the post-install version check still fails (e.g. global bin not on PATH), tell the user:
> "Install succeeded but `mutagent` isn't on PATH yet. Common fixes:
> - bun: `export PATH=\"$HOME/.bun/bin:$PATH\"`
> - npm: check `npm config get prefix` and add `<prefix>/bin` to PATH
> - pnpm: `pnpm setup` then restart your shell
> - yarn: `yarn global bin` and add that path to PATH"
> Then ask the user to restart their shell or source the relevant rc file, and re-invoke me.

**2d. On rejection (option 3 or 4)**, output the four install commands as a verbatim block and STOP. Do NOT proceed with any workflow until the user confirms the CLI is installed and re-invokes the skill.

```bash
# Pick one (Recommended in order: bun > pnpm > yarn > npm)
bun add -g @mutagent/cli
pnpm add -g @mutagent/cli
yarn global add @mutagent/cli
npm install -g @mutagent/cli
```

**Why proactive install (not just "stop and tell")**: a user invoking this Skill has already shown intent to use Mutagent. Forcing them to context-switch to a separate terminal, copy-paste an install command, and re-invoke the agent is friction that often loses the user. Asking once + installing on consent is the smoother path. The opt-out (option 3/4) preserves user control.

**Step 3 -- Version compatibility check:**
Parse `_compat.cliVersion` from the `--version --json` output and compare against
`metadata.skill_min_cli_version` (above in this file's frontmatter, currently `0.1.163`).

- If `cliVersion >= metadata.skill_min_cli_version`: all good, proceed normally.
- If `cliVersion < metadata.skill_min_cli_version`: emit a **PROMINENT PERSISTENT WARN** to the user:

  > Warning: **CLI version mismatch**: Your `mutagent` CLI is `{cliVersion}` but this Skill
  > requires `>= 0.1.163`. Some features may not work correctly.
  > Upgrade: `npm install -g @mutagent/cli@latest`

  **DO NOT BLOCK** -- proceed with the requested workflow after showing the warn.
  Re-emit this warn at the start of every subsequent Skill invocation until the user upgrades.

**Per decision D4 (locked 2026-05-03)**: version mismatch is warn-only, never a hard block.

---

## Login (RUN SECOND — most commands are login-gated)

Install, feedback, usage, workspaces, and providers commands all require
an authenticated session. Establish it early:

- **CI / automated**: `export MUTAGENT_API_KEY=mt_... && mutagent login --json` -- no browser, no prompts.
- **Onboarding a user**: `mutagent login --browser --json` -- CLI prints auth URL to stdout, polls 5 min. **Surface the URL verbatim to the user.** `--non-interactive` is NOT needed when `--browser` is set.

`mutagent login` is canonical. `mutagent auth login` is a back-compat alias. Both delegate to a single shared implementation; they are thin wrappers and stay that way by design.

Check current state anytime with `mutagent auth status --json`.

---

## Command Surface (active commands)

Run `mutagent <command> --help` for the authoritative, current flag list — this
skill never inlines flags. The active surface:

| Command | Purpose | Workflow |
|---|---|---|
| `login` / `auth` | Authenticate; check/clear session | [workflows/setup.md](./workflows/setup.md) |
| `init` | Interactive project setup wizard | [workflows/setup.md](./workflows/setup.md) |
| `config` | View/set local CLI config | [workflows/setup.md](./workflows/setup.md) |
| `workspaces` | List/select active workspace | [workflows/setup.md](./workflows/setup.md) |
| `providers` | List providers + model catalog | [workflows/setup.md](./workflows/setup.md) |
| `usage` | Show usage + quota | [workflows/setup.md](./workflows/setup.md) |
| `skills install` | Install this skill into a project | [workflows/setup.md](./workflows/setup.md) |
| `hooks install` | Install Claude Code telemetry hooks | [workflows/setup.md](./workflows/setup.md) |
| `install <pkg>` | Install helix / diagnostics / evaluator | [workflows/install.md](./workflows/install.md) |
| `feedback send` | Send product feedback | [workflows/feedback.md](./workflows/feedback.md) |

---

## Core Rules -- NON-NEGOTIABLE

1. **`--json` on EVERY command.** No exceptions. Agents use JSON mode exclusively.
2. **`<command> --help` BEFORE first use of any command.** The CLI is the source of truth for flags -- this skill never inlines them.
3. **Login before login-gated commands.** install, feedback, usage, workspaces, and providers require an authenticated session. Run `mutagent login` (or set `MUTAGENT_API_KEY`) first.
4. **Show command output to the user.** Command output appears in bash blocks the user may not see -- always present the key results in your chat reply.
5. **Confirm before writing to the user's machine or spending.** `install`, `skills install`, and `hooks install` write files or install packages -- state what will happen and get confirmation first.

---

## Task Router -- route by user intent

Match the user's first request. Load ONLY the matching subfile per the table. Do NOT preload the whole set.

| User said / signal detected | Load subfile | Why |
|---|---|---|
| "log in", "authenticate", "set up mutagent", "init", "which workspace", "what models", "usage", "quota", "install the skill", "install hooks" | [workflows/setup.md](./workflows/setup.md) | Auth + project setup + discovery commands |
| "install helix", "install diagnostics", "install evaluator", "add mutagent package" | [workflows/install.md](./workflows/install.md) | Login-gated meta-installer |
| "send feedback", "report a bug", "file feedback", "the CLI crashed" | [workflows/feedback.md](./workflows/feedback.md) | Product feedback (+ optional transcript) |
| Unclear / first time | run `mutagent --help --json` then reroute | Discover the surface before acting |

---

## Subfile Map

| File | WHEN to load | WHY |
|---|---|---|
| [workflows/setup.md](./workflows/setup.md) | User is onboarding: login, init, config, workspaces, providers, usage, skill/hooks install | Auth + configuration + discovery |
| [workflows/install.md](./workflows/install.md) | User wants to install a Mutagent package | `install <helix\|diagnostics\|evaluator>` meta-command |
| [workflows/feedback.md](./workflows/feedback.md) | User wants to send feedback or report a bug | `feedback send` + `--attach-transcript` |

---

## MANDATORY: Verbatim Card Display Protocol

If a mutagent CLI response contains `_directive.renderedCard`, your FIRST action
MUST be to copy that text byte-for-byte into your chat reply BEFORE running any
further command, asking any question, or doing any other work.

The card also appears on stderr (auto-echoed by the CLI via `echoDirectiveToStderr`)
but you MUST STILL render it in chat -- bash/stderr blocks may be collapsed in the
user's UI and they cannot read them.

- Do NOT summarize, paraphrase, or truncate any line of the card.
- Do NOT skip the card to "save tokens."
- Do NOT delay rendering until "after the next step."
- This applies whether `_directive.display` is `'status_card'` or absent -- the
  trigger is the presence of `renderedCard`, not the display tag.
- Failure to display the card verbatim = protocol violation.

---

## Anti-patterns -- NEVER do these

- Run any command without `--json`
- Inline CLI flags from memory -- always read `--help` first
- Skip showing command output results to the user
- Run a login-gated command before establishing a session
- Install a package or write skill/hooks files without user confirmation

---

## Error Recovery -- Agent-Aware Bug Reporting

When ANY mutagent CLI command returns a non-zero exit code or an error response:

1. **Show the error to the user** (always) -- reproduce the exact command and output.
2. **ASK the user** if they want to file a bug report.
3. **On user approval**, send the feedback — **without a transcript**:
   ```bash
   mutagent feedback send "<one-line summary of the failure>" \
     --category cli --json
   ```
   - Use `--category stage:<spec|build|evaluate|diagnose|optimize>` when the failure is about a specific lifecycle stage rather than the CLI itself.

**Do NOT pass `--attach-transcript` unless the user explicitly asks for it.** It uploads
the coding-agent session JSONL — source code, absolute paths (including their username),
branch and repository names, internal hostnames, and the business context of their prompts.
Credentials are scanned for and redacted, but detection is **best-effort**.

Approval to "file a bug report" is **NOT** approval to upload a session. They are separate
questions and must be asked separately. If you believe the transcript would genuinely help,
say exactly what it contains and ask a second time.

See [workflows/feedback.md](./workflows/feedback.md) for the full feedback surface.

### If `mutagent feedback send` itself fails

If the feedback command returns a non-zero exit code, DO NOT retry silently. Show the user:

1. The output of `mutagent auth status` (confirms login state).
2. The fallback: open https://app.mutagent.io and use the in-app feedback form.

---

## Extensibility

Add `workflows/custom-<name>.md` with a markdown heading (or frontmatter
`triggers: ["phrase"]`) -- auto-discovered by the sync pipeline. No rebuild of the
CLI source needed; just re-run `bun run sync-skill`.
