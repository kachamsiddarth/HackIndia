import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.session) {
      const { user, session } = data;
      const providerToken = session.provider_token;

      // Upsert user profile into public.users
      if (user) {
        const githubUsername =
          user.user_metadata.preferred_username ||
          user.user_metadata.user_name ||
          user.email?.split("@")[0] ||
          "user";
        const displayName =
          user.user_metadata.full_name || user.user_metadata.name || githubUsername;
        const avatarUrl = user.user_metadata.avatar_url || "";

        await supabase.from("users").upsert({
          id: user.id,
          github_username: githubUsername,
          display_name: displayName,
          avatar_url: avatarUrl,
          github_token: providerToken || "",
          updated_at: new Date().toISOString(),
        });
      }

      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  // Return to login page if there's an error
  return NextResponse.redirect(`${origin}/login?error=Could%20not%20authenticate`);
}
