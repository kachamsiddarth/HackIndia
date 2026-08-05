import { NextResponse } from "next/server";
import { getPipelineResults } from "@/lib/pipeline/service";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ data: null, error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, { status: 401 });

  try {
    const { id } = await params;
    const results = await getPipelineResults(id, user.id);
    if (!results) {
      return NextResponse.json({ data: null, error: { message: "Pipeline not found.", code: "PIPELINE_NOT_FOUND" } }, { status: 404 });
    }
    return NextResponse.json({ data: results, error: null });
  } catch (caught: unknown) {
    const message = caught instanceof Error ? caught.message : "Unable to retrieve pipeline results.";
    return NextResponse.json({ data: null, error: { message, code: "PIPELINE_RESULTS_FAILED" } }, { status: 500 });
  }
}
