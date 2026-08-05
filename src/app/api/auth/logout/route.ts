import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return NextResponse.json(
      { data: null, error: { message: error.message, code: "LOGOUT_FAILED" } },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: { message: "Logged out successfully" }, error: null });
}
