import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  props: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id: fixId } = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { data: null, error: { message: "Unauthorized", code: "UNAUTHORIZED" } },
      { status: 401 }
    );
  }

  try {
    const admin = createAdminClient();

    // Fetch fix record
    const { data: fix, error: fixErr } = await admin
      .from("fixes")
      .select("*")
      .eq("id", fixId)
      .single();

    if (fixErr || !fix) {
      return NextResponse.json(
        { data: null, error: { message: "Fix not found", code: "NOT_FOUND" } },
        { status: 404 }
      );
    }

    // Update status to approved
    const { data: updatedFix, error: updateErr } = await admin
      .from("fixes")
      .update({
        status: "approved",
        updated_at: new Date().toISOString(),
      })
      .eq("id", fixId)
      .select()
      .single();

    if (updateErr) throw new Error(updateErr.message);

    // Record governance audit log
    await admin.from("governance_records").insert({
      pipeline_run_id: fix.pipeline_run_id,
      agent_name: "UserApproval",
      action: "FIX_APPROVED",
      reasoning: `User ${user.email ?? user.id} manually approved fix ${fixId}`,
      metadata: { fixId, userId: user.id },
    });

    return NextResponse.json({
      data: { fix: updatedFix, message: "Fix successfully approved" },
      error: null,
    });
  } catch (caught: unknown) {
    const message = caught instanceof Error ? caught.message : "Failed to approve fix.";
    return NextResponse.json(
      { data: null, error: { message, code: "APPROVE_FIX_FAILED" } },
      { status: 500 }
    );
  }
}
