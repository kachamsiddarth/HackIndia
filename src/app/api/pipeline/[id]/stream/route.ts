import { getPipelineForUser } from "@/lib/pipeline/service";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const encoder = new TextEncoder();
const POLL_INTERVAL_MS = 1_000;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ data: null, error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, { status: 401 });

  const { id } = await params;
  const initialRun = await getPipelineForUser(id, user.id);
  if (!initialRun) return Response.json({ data: null, error: { message: "Pipeline not found.", code: "PIPELINE_NOT_FOUND" } }, { status: 404 });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller): Promise<void> {
      let lastPayload = "";
      const send = (event: string, data: unknown): void => {
        const payload = JSON.stringify(data);
        if (payload === lastPayload && event === "status") return;
        lastPayload = payload;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${payload}\n\n`));
      };

      try {
        let run = initialRun;
        while (true) {
          send("status", run);
          if (["completed", "failed", "cancelled"].includes(run.status)) {
            send("complete", run);
            break;
          }
          await wait(POLL_INTERVAL_MS);
          const nextRun = await getPipelineForUser(id, user.id);
          if (!nextRun) {
            send("error", { message: "Pipeline is no longer available." });
            break;
          }
          run = nextRun;
        }
      } catch (caught: unknown) {
        const message = caught instanceof Error ? caught.message : "Pipeline stream failed.";
        send("error", { message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
    },
  });
}

function wait(durationMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}
