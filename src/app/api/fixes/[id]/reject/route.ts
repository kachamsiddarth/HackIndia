import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
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
    let reason = "Rejected by user";
    try {
      const body = await request.json();
      if (body?.reason) reason = body.reason;
    } catch {
      // Empty body is okay
    }

    const admin = createAdminClient();

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

    const { data: updatedFix, error: updateErr } = await admin
      .from("fixes")
      .update({
        status: "rejected",
        reasoning: reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", fixId)
      .select()
      .single();

    if (updateErr) throw new Error(updateErr.message);

    await admin.from("governance_records").insert({
      pipeline_run_id: fix.pipeline_run_id,
      agent_name: "UserApproval",
      action: "FIX_REJECTED",
      reasoning: `User ${user.email ?? user.id} rejected fix ${fixId}: ${reason}`,
      metadata: { fixId, userId: user.id, reason },
    });

    return NextResponse.json({
      data: { fix: updatedFix, message: "Fix successfully rejected" },
      error: null,
    });
  } catch (caught: unknown) {
    const message = caught instanceof Error ? caught.message : "Failed to reject fix.";
    return NextResponse.json(
      { data: null, error: { message, code: "REJECT_FIX_FAILED" } },
      { status: 500 }
    );
  }
}
