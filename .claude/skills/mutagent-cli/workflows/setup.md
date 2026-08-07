---
name: mutagent-cli-workflows-setup
description: |
  Onboarding + configuration workflow. Covers login/auth, the init wizard,
  config, workspaces, providers (incl. model catalog), usage/quota, and
  installing this skill + Claude Code telemetry hooks.
triggers:
  - "log in"
  - "authenticate"
  - "set up mutagent"
  - "mutagent init"
  - "which workspace"
  - "what models"
  - "check usage"
  - "install the skill"
  - "install hooks"
---

# Workflow — Setup (Auth, Config, Discovery)

> **Scope**: authentication, local configuration, discovery, and installing the
> skill/hooks. `skills install` and `hooks install` write files into the user's
> project — confirm first (Core Rule 5).

Read the **Core Rules** in [SKILL.md](../SKILL.md) first. Key reminders:
- `--json` on every command
- `<command> --help` before first use
- Login before login-gated commands

---

## 1. Login / auth

`mutagent login` is canonical; `mutagent auth login` is a back-compat alias (both
delegate to one shared implementation).

```bash
# CI / automated (no browser)
export MUTAGENT_API_KEY=mt_...
mutagent login --json

# Onboarding a real user (browser)
mutagent login --browser --json     # prints an auth URL to stdout, polls 5 min
                                     # → surface the URL to the user VERBATIM

mutagent auth status --json          # check session state
mutagent auth logout --json          # clear stored credentials
```

---

## 2. init (config + skill install)

```bash
mutagent init --help
mutagent init --json     # writes .mutagentrc.json + installs this skill
```

`init` writes `.mutagentrc.json` (endpoint / workspace / org — skipped if
present) and installs the Mutagent CLI skill into `.claude/skills/mutagent-cli/`.
It never prompts. If the user is not logged in, it prints login guidance and
exits — run `mutagent login` first, then re-run `mutagent init`.

---

## 3. config

```bash
mutagent config list --json                 # show all config
mutagent config get <key> --json            # keys: apiKey, endpoint, format, timeout,
                                             #       defaultWorkspace, defaultOrganization
mutagent config set workspace <id> --json   # set default workspace
mutagent config set org <id> --json         # set default organization
```

---

## 4. workspaces (read-only)

```bash
mutagent workspaces list --json          # list workspaces
mutagent workspaces get <id> --json      # workspace details
```

To make a workspace the default, use `mutagent config set workspace <id>`.

---

## 5. providers (BYOK + model catalog)

```bash
mutagent providers list --json                 # configured providers
mutagent providers list --models --json        # available models per provider (/providers/catalog)
mutagent providers get <id> --json             # provider details
mutagent providers test <id> --json            # test connectivity
```

Use `providers list --models` to discover which models are available before
selecting one for any downstream tool.

---

## 6. usage / quota

```bash
mutagent usage --json     # resource counts + quota
```

Show the usage output to the user so spend/quota is transparent.

---

## 7. Install the skill + hooks

```bash
# Install THIS skill into the current project's .claude/skills/
mutagent skills install --json

# Install Claude Code telemetry hooks (safe merge into .claude/settings.local.json —
# never overwrites existing hooks). These emit session telemetry to the platform.
mutagent hooks install --json
```

Both commands write into the user's project — state what will be written and
confirm before running (Core Rule 5).

---

## Common pitfalls

- Running login-gated commands (providers, usage, workspaces) before `mutagent login`.
- Forgetting `--json` (Rule 1).
- Running `hooks install` / `skills install` without telling the user what files change.

---

## Cross-references

- [SKILL.md](../SKILL.md) → Core Rules + Task Router
- [workflows/install.md](./install.md) → install helix / diagnostics / evaluator packages
