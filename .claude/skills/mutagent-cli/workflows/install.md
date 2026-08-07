---
name: mutagent-cli-workflows-install
description: |
  Meta-installer workflow. Installs a Mutagent package (helix, diagnostics, or
  evaluator) into the user's environment via `mutagent install <package>`.
  Login-gated. diagnostics/evaluator come from public npm; helix is fetched
  from a private registry via a login-brokered signed URL (no static secret).
triggers:
  - "install diagnostics"
  - "install evaluator"
  - "install helix"
  - "mutagent install"
  - "add mutagent package"
  - "set up diagnostics"
  - "set up evaluator"
---

# Workflow — Install (Meta-Installer)

> **Scope differs by package** — read `scope` in the response, never assume:
> - `helix` → installed into the CURRENT project directory (`scope: "project"`).
> - `diagnostics` / `evaluator` → **npm installs the package GLOBALLY**
>   (`scope: "global"`, literally `npm install -g`). It does NOT go in the
>   user's project. Its skill init is the part you later run in the project.
>
> This WRITES to the user's machine — confirm before running (Core Rule 5).
>
> **`success: true` does NOT mean the user is ready to go.** For `diagnostics`
> and `evaluator` it means the npm package landed; the skill still needs the
> package's own init. Branch on `skillInstalled` — see *Output handling* below.

Read the **Core Rules** in [SKILL.md](../SKILL.md) first. Key reminders:
- `--json` on every command
- `<command> --help` before first use
- **Login-gated** — run `mutagent login` first
- Confirm before installing (writes to the user's machine)

---

## Surface

```bash
mutagent install --help    # authoritative flags — read before first use

mutagent install <package> [--harness <claude-code|codex|omp>] \
                           [--version <v>] [--json]
```

Where `<package>` is one of:

| Package | Source | Notes |
|---|---|---|
| `diagnostics` | public npm `@mutagent/diagnostics` | Ready to install |
| `evaluator` | public npm `@mutagent/evaluator` | Ready to install |
| `helix` | private registry via login-brokered signed URL | Ready to install — login-gated download, sha256-verified, then initialized into your project |

**Flags** (verify against `--help`):
- `--harness <claude-code|codex|omp>` -- target coding-agent harness (default `claude-code`).
- Install scope is FIXED PER PACKAGE and is not selectable: `helix` installs into the current directory; `diagnostics`/`evaluator` are installed GLOBALLY by npm. `--global` is retired: passing it fails and explains both paths.
- `--version <v>` -- pin a specific version (default: latest).
- `--json` -- structured output (Rule 1).

---

## Steps

```
1. mutagent auth status --json
   → confirm the user is logged in (install is login-gated)
   → if not authenticated, run the login workflow first

2. mutagent install --help
   → read the current packages + flags (Rule 2)

3. Confirm with the user WHAT will be installed and WHERE
   → state the REAL destination for the package being installed, e.g.
      helix:        "I'll install helix into <current directory>. Proceed?"
      diagnostics:  "I'll install @mutagent/diagnostics GLOBALLY via npm, then
                     you'll run its init inside your project. Proceed?"

4. mutagent install <package> [--harness <h>] [--version <v>] --json
   → run the install
   → show the command output to the user: package, version, harness, and
      `scope`. Surface `projectPath` ONLY when `scope` is `"project"` — it is
      ABSENT from the response on the global npm path.

5. CHECK `skillInstalled` in the JSON response — do NOT stop at `success: true`
   → skillInstalled === true  → done; the skill is installed and usable
   → skillInstalled === false → NOT done. Tell the user plainly that the npm
      package is installed but the skill is not, then surface `nextStep`
      (e.g. `mutagent-diagnostics init`) as the command to run next.
      Confirm before running it — it writes to their project (Core Rule 5).
```

---

## Examples

```bash
mutagent install helix --json
mutagent install helix --harness codex --json
mutagent install diagnostics --json
mutagent install evaluator --version 1.2.3 --json
mutagent install diagnostics --harness codex --json
```

---

## Output handling

Success shape:

```json
{
  "success": true,
  "package": "diagnostics",
  "version": "1.2.3",
  "harness": "claude-code",
  "scope": "global",
  "skillInstalled": false,
  "nextStep": "mutagent-diagnostics init",
  "_links": { "install": "...", "login": "..." }
}
```

`helix` instead returns `"scope": "project"` with `"projectPath"`, and
`"skillInstalled": true`.

- **`skillInstalled` is the field to branch on — NOT `success`.** `success: true`
  reports that the install step did its job, not that the user is ready.
  `nextStep` is present only when work remains.
- `skillInstalled: false` (npm packages — `diagnostics`, `evaluator`): the npm
  package is installed; the harness skill is **not**. Say so explicitly and give
  the user `nextStep`. Reporting only "installed" here is a known past defect —
  users were told a skill had landed when none had.
- `skillInstalled: true` (`helix`): the CLI resolved a signed download URL from
  the login broker, downloaded + sha256-verified the plugin, and ran its init
  into the project. Nothing further is needed. An `INTEGRITY_ERROR` means the
  download failed checksum verification — retry.
- **`scope` tells you WHERE it went. Read it; do not assume.**
  - `"global"` (`diagnostics`, `evaluator`) — npm installed the package into its
    GLOBAL root (`npm install -g`). The package is **not** in the user's project;
    never tell the user it is. No path is reported — run `npm root -g` if the
    user needs the directory.
  - `"project"` (`helix`) — installed into `projectPath`. Surface it so the user
    can confirm the location.
- On an auth error (including a broker `AUTH_REQUIRED`): route to the login
  workflow, then retry.
- On `INVALID_ARGUMENTS` naming `--global`: the flag is retired. Re-run without
  it, or `cd` to the intended project first — the error names the path that
  would have been used.

---

## Common pitfalls

- **Treating `success: true` as "the user is ready".** For `diagnostics` and
  `evaluator` it is not — check `skillInstalled` and surface `nextStep`. Stopping
  at `success` leaves the user with a package and no skill, believing it works.
- **Telling the user a globally-installed package is in their project.**
  `diagnostics` and `evaluator` install globally (`npm install -g`). Report the
  location from `scope`, never from the directory you ran in.
- Running before login → auth error (install is login-gated).
- Assuming `helix` installs from public npm — it is fetched from a private registry via a login-brokered signed URL (the CLI holds no static secret).
- Installing without confirming with the user first (Core Rule 5).
- Passing `--global` — retired; scope is fixed per package and is not selectable.

---

## Cross-references

- [SKILL.md](../SKILL.md) → Core Rules + Task Router
- [workflows/setup.md](./setup.md) → login (prerequisite for install)
