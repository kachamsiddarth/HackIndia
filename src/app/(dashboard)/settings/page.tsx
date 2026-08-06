"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";
import styles from "./page.module.css";

export default function SettingsPage() {
  const [threshold, setThreshold] = useState(85);
  const [failOnRegression, setFailOnRegression] = useState(true);
  const [copied, setCopied] = useState(false);
  const workflow = workflowTemplate(threshold, failOnRegression);

  async function copyWorkflow() { await navigator.clipboard.writeText(workflow); setCopied(true); }
  function downloadWorkflow() { const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([workflow], { type: "text/yaml" })); link.download = "accessdiff.yml"; link.click(); URL.revokeObjectURL(link.href); }

  return <div className={styles.page}>
    <p className={styles.eyebrow}>CI/CD integration</p><h1>GitHub Actions configuration</h1><p className={styles.description}>Configure the generated workflow for your repositories. Store the two values shown below as GitHub Actions secrets.</p>
    <Card className={styles.card}><label>Accessibility score threshold <input type="number" min="0" max="100" value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} /></label><label className={styles.checkbox}><input type="checkbox" checked={failOnRegression} onChange={(event) => setFailOnRegression(event.target.checked)} /> Fail the workflow when a new regression is found</label></Card>
    <Card className={styles.card}><h2>Required GitHub secrets</h2><ul><li><code>ACCESSDIFF_WEBHOOK_URL</code>: <code>{typeof window === "undefined" ? "https://your-domain/api/webhooks/github" : `${window.location.origin}/api/webhooks/github`}</code></li><li><code>ACCESSDIFF_WEBHOOK_SECRET</code>: the same private value as <code>GITHUB_WEBHOOK_SECRET</code> in AccessDiff.</li></ul></Card>
    <Card className={styles.card}><div className={styles.actions}><h2>Workflow file</h2><Button variant="secondary" onClick={copyWorkflow}>{copied ? "Copied" : "Copy YAML"}</Button><Button onClick={downloadWorkflow}>Download YAML</Button></div><pre><code>{workflow}</code></pre></Card>
  </div>;
}

function workflowTemplate(threshold: number, failOnRegression: boolean): string {
  return `name: AccessDiff accessibility regression check

on:
  push:
    branches: ["**"]

jobs:
  accessdiff:
    runs-on: ubuntu-latest
    env:
      ACCESSDIFF_MIN_SCORE: "${threshold}"
      ACCESSDIFF_FAIL_ON_REGRESSION: "${failOnRegression}"
    steps:
      - name: Notify AccessDiff of the commit range
        env:
          ACCESSDIFF_WEBHOOK_URL: \${{ secrets.ACCESSDIFF_WEBHOOK_URL }}
          ACCESSDIFF_WEBHOOK_SECRET: \${{ secrets.ACCESSDIFF_WEBHOOK_SECRET }}
        run: |
          payload=$(jq -nc --arg repository "\${{ github.repository }}" --arg before "\${{ github.event.before }}" --arg after "\${{ github.sha }}" --arg ref "\${{ github.ref }}" '{repository:{full_name:$repository},before:$before,after:$after,ref:$ref}')
          signature="sha256=$(printf '%s' "$payload" | openssl dgst -sha256 -hmac "$ACCESSDIFF_WEBHOOK_SECRET" -hex | sed 's/^.* //')"
          curl --fail-with-body --request POST "$ACCESSDIFF_WEBHOOK_URL" --header "Content-Type: application/json" --header "X-GitHub-Event: push" --header "X-Hub-Signature-256: $signature" --data "$payload"`;
}
