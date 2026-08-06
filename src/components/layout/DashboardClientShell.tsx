"use client";

import React, { type ReactNode } from "react";
import { Sidebar, Header } from "@/components/layout";
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
    <div className={styles.container}>
      <Sidebar user={userProfile} />
      <div className={styles.mainWrapper}>
        <Header />
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
