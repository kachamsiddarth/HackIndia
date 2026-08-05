import { type HTMLAttributes, type ReactNode } from "react";
import styles from "./Badge.module.css";

export type BadgeVariant =
  | "critical"
  | "major"
  | "minor"
  | "advisory"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "neutral";

export type BadgeSize = "sm" | "md" | "lg";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** Visual variant — determines color scheme */
  variant?: BadgeVariant;
  /** Size preset */
  size?: BadgeSize;
  /** Show a colored dot indicator */
  showDot?: boolean;
}

/**
 * Inline status indicator for severity levels and states.
 * Used throughout the app for issue severity, pipeline status, and more.
 */
export default function Badge({
  variant = "neutral",
  size = "md",
  showDot = false,
  className,
  children,
  ...props
}: BadgeProps): ReactNode {
  const classNames = [
    styles.badge,
    styles[variant],
    styles[size],
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classNames} {...props}>
      {showDot && <span className={styles.dot} aria-hidden="true" />}
      {children}
    </span>
  );
}
