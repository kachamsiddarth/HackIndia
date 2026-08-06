import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function safeNext(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

function loginFailure(request: Request, message: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", message.slice(0, 180));
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const providerError = searchParams.get("error_description") ?? searchParams.get("error");
  const code = searchParams.get("code");
  if (providerError || !code) {
    return loginFailure(request, providerError ?? "GitHub did not return an authorization code.");
  }

  const destination = new URL(safeNext(searchParams.get("next")), request.url);
  const response = NextResponse.redirect(destination);
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.headers.get("cookie")
            ? request.cookies.getAll()
            : [];
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session || !data.user) {
    return loginFailure(request, error?.message ?? "Supabase did not return a session.");
  }

  const user = data.user;
  const githubUsername = user.user_metadata.preferred_username || user.user_metadata.user_name || user.email?.split("@")[0] || "user";
  const displayName = user.user_metadata.full_name || user.user_metadata.name || githubUsername;
  const { error: profileError } = await supabase.from("users").upsert({
    id: user.id,
    github_username: githubUsername,
    display_name: displayName,
    avatar_url: user.user_metadata.avatar_url || "",
    github_token: data.session.provider_token || "",
    updated_at: new Date().toISOString(),
  });

  if (profileError) {
    return loginFailure(request, `Unable to save your profile: ${profileError.message}`);
  }
  return response;
}
