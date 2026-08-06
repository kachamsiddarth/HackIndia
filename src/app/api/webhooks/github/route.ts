import { createHmac, timingSafeEqual } from "node:crypto";
import { after, NextResponse } from "next/server";
import { createPipelineRun, executePipeline } from "@/lib/pipeline/service";
import { createAdminClient } from "@/lib/supabase/server";

interface PushPayload {
  before?: string;
  after?: string;
  repository?: { full_name?: string };
}

export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ data: null, error: { message: "Webhook secret is not configured." } }, { status: 503 });

  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  if (!isValidSignature(rawBody, signature, secret)) {
    return NextResponse.json({ data: null, error: { message: "Invalid webhook signature." } }, { status: 401 });
  }
  if (request.headers.get("x-github-event") !== "push") {
    return NextResponse.json({ data: { accepted: true, ignored: true }, error: null }, { status: 202 });
  }

  try {
    const payload = JSON.parse(rawBody) as PushPayload;
    const repository = payload.repository?.full_name;
    if (!repository || !payload.before || !payload.after || /^0+$/.test(payload.before)) {
      return NextResponse.json({ data: { accepted: true, ignored: true }, error: null }, { status: 202 });
    }
    const admin = createAdminClient();
    const { data: project, error } = await admin.from("projects").select("id, user_id").eq("github_repo", repository).maybeSingle();
    if (error) throw new Error(error.message);
    if (!project) return NextResponse.json({ data: { accepted: true, ignored: true }, error: null }, { status: 202 });

    const run = await createPipelineRun({ projectId: project.id, userId: project.user_id, baseCommitSha: payload.before, headCommitSha: payload.after });
    after(async () => executePipeline(run.id));
    return NextResponse.json({ data: { accepted: true, pipelineRunId: run.id }, error: null }, { status: 202 });
  } catch (caught: unknown) {
    return NextResponse.json({ data: null, error: { message: caught instanceof Error ? caught.message : "Webhook processing failed." } }, { status: 500 });
  }
}

function isValidSignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature?.startsWith("sha256=")) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  const actualBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}
