import { type ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { DashboardClientShell } from "@/components/layout";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Extract user info for sidebar
  const userProfile = user
    ? {
        name:
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split("@")[0] ||
          "Developer",
        handle:
          user.user_metadata?.preferred_username ||
          user.user_metadata?.user_name ||
          user.email?.split("@")[0] ||
          "github",
        avatarUrl: user.user_metadata?.avatar_url,
      }
    : undefined;

  return (
    <DashboardClientShell userProfile={userProfile}>
      {children}
    </DashboardClientShell>
  );
}
