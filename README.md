# AccessDiff

AccessDiff is an AI-assisted accessibility regression workflow for GitHub repositories. It compares two commits, reports newly introduced WCAG issues, generates and verifies remediation patches, and gives developers a reviewable code-diff workspace.

## What it includes

- GitHub OAuth project import and commit comparison
- Regression-only accessibility pipeline with persisted runs, stages, issues, and fixes
- Before/after code-diff review, approval, rejection, rollback, and PR creation actions
- Governance records and Sarvam-powered assistant capabilities
- Imported-repository-only accessibility Experience Mode
- Signed GitHub push webhook and a ready-to-copy GitHub Actions workflow

## Local setup

1. Copy `.env.local.example` to `.env.local` and set the required secrets. Never commit `.env.local`.
2. Install dependencies with `npm install`.
3. Apply the Supabase migrations in `supabase/migrations/` to the linked project.
4. Start the app with `npm run dev`, then open `http://localhost:3000`.

Required variables are documented in `.env.local.example`. GitHub webhook processing additionally requires `GITHUB_WEBHOOK_SECRET`; configure the same value in the GitHub repository webhook and GitHub Actions secrets.

## Verification commands

```bash
npm run lint
npx tsc --noEmit
npm run build
node scripts/audit-landing.mjs http://127.0.0.1:3000/
node scripts/audit-keyboard.mjs http://127.0.0.1:3000/
```

The two audit scripts require a running local app. They use Playwright and axe-core to check WCAG rules, landmarks, heading structure, and accessible names on the public landing page.

## CI/CD

`.github/workflows/accessdiff.yml` is the repository template. Add the documented GitHub Actions secrets before enabling it. The workflow posts a signed payload to `/api/webhooks/github`; the route validates the HMAC signature before it processes a push event.

## Project documentation

Implementation and product decisions are maintained in `Tracker.md`, `ImplementationPlan.md`, `Memory.md`, `PRD.md`, `Schema.md`, `Design.md`, `AppFlow.md`, and `Rules.md`.
