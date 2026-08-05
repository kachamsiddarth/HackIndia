import { NextResponse } from "next/server";
import { getPipelineForUser } from "@/lib/pipeline/service";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorizedResponse();

  try {
    const { id } = await params;
    const run = await getPipelineForUser(id, user.id);
    if (!run) return notFoundResponse();
    return NextResponse.json({ data: run, error: null });
  } catch (caught: unknown) {
    const message = caught instanceof Error ? caught.message : "Unable to retrieve pipeline status.";
    return NextResponse.json({ data: null, error: { message, code: "PIPELINE_STATUS_FAILED" } }, { status: 500 });
  }
}

function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ data: null, error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, { status: 401 });
}

function notFoundResponse(): NextResponse {
  return NextResponse.json({ data: null, error: { message: "Pipeline not found.", code: "PIPELINE_NOT_FOUND" } }, { status: 404 });
}
