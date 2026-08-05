"use client";

import { type ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";

export interface VerificationStatusIndicatorProps {
  status: "verified" | "unverified" | "failed" | string;
  testRunner?: string; // e.g. "axe-core / Chromium"
}

export default function VerificationStatusIndicator({
  status,
  testRunner = "axe-core Chromium",
}: VerificationStatusIndicatorProps): ReactNode {
  const isVerified = status.toLowerCase() === "verified";

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
      <Badge variant={isVerified ? "success" : "neutral"} size="sm" showDot>
        {isVerified ? "Verified" : "Unverified"}
      </Badge>
      <span style={{ fontSize: "0.78rem", color: "var(--color-text-tertiary)" }}>
        ({testRunner})
      </span>
    </div>
  );
}
