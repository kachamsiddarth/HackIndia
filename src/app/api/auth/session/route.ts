import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { data: null, error: { message: "Unauthorized", code: "UNAUTHORIZED" } },
      { status: 401 }
    );
  }

  // Fetch full user profile
  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  return NextResponse.json({
    data: {
      user: {
        id: user.id,
        email: user.email,
        github_username: profile?.github_username || user.user_metadata?.user_name || "",
        display_name: profile?.display_name || user.user_metadata?.full_name || "",
        avatar_url: profile?.avatar_url || user.user_metadata?.avatar_url || "",
      },
    },
    error: null,
  });
}
