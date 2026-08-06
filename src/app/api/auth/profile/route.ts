import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ data: null, error: { message: "Unauthorized" } }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => ({}));
  const providerToken = typeof body === "object" && body !== null && "providerToken" in body && typeof body.providerToken === "string"
    ? body.providerToken
    : "";
  const githubUsername = user.user_metadata.preferred_username || user.user_metadata.user_name || user.email?.split("@")[0] || "user";
  const displayName = user.user_metadata.full_name || user.user_metadata.name || githubUsername;
  const { error } = await supabase.from("users").upsert({
    id: user.id,
    github_username: githubUsername,
    display_name: displayName,
    avatar_url: user.user_metadata.avatar_url || "",
    github_token: providerToken,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return NextResponse.json({ data: null, error: { message: error.message } }, { status: 500 });
  }
  return NextResponse.json({ data: { saved: true }, error: null });
}
