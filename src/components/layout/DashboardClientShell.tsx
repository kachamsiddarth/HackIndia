"use client";

import React, { type ReactNode } from "react";
import { Sidebar, Header } from "@/components/layout";
import { GlobalVoiceAgent } from "@/components/voice/GlobalVoiceAgent";
import { KeyboardShortcutProvider } from "@/components/accessibility/KeyboardShortcutProvider";
import type { UserProfile } from "@/components/layout/Sidebar/Sidebar";
import styles from "@/app/(dashboard)/layout.module.css";

export interface DashboardClientShellProps {
  userProfile?: UserProfile;
  children: ReactNode;
}

export function DashboardClientShell({
  userProfile,
  children,
}: DashboardClientShellProps) {
  return (
    <KeyboardShortcutProvider>
      <div className={styles.container}>
        <Sidebar user={userProfile} />
        <div className={styles.mainWrapper}>
          <Header />
          <main className={styles.content}>{children}</main>
          <GlobalVoiceAgent />
        </div>
      </div>
    </KeyboardShortcutProvider>
  );
}
