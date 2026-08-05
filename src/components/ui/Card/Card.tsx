import { type HTMLAttributes, type ReactNode } from "react";
import styles from "./Card.module.css";

export type CardVariant = "default" | "glass";
export type CardPadding = "none" | "sm" | "md" | "lg";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Visual variant */
  variant?: CardVariant;
  /** Padding size */
  padding?: CardPadding;
  /** Whether the card responds to hover with elevation and border change */
  interactive?: boolean;
}

/**
 * Container component for grouping related content.
 * Supports glass morphism variant and interactive hover state.
 */
export default function Card({
  variant = "default",
  padding = "md",
  interactive = false,
  className,
  children,
  ...props
}: CardProps): ReactNode {
  const paddingMap: Record<CardPadding, string> = {
    none: styles.paddingNone,
    sm: styles.paddingSm,
    md: styles.paddingMd,
    lg: styles.paddingLg,
  };

  const classNames = [
    styles.card,
    variant === "glass" ? styles.glass : "",
    interactive ? styles.interactive : "",
    paddingMap[padding],
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classNames} {...props}>
      {children}
    </div>
  );
}

/* ── Compound Components ── */

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function CardHeader({
  title,
  description,
  action,
  className,
  ...props
}: CardHeaderProps): ReactNode {
  return (
    <div className={`${styles.header} ${className ?? ""}`} {...props}>
      <div>
        <h3 className={styles.headerTitle}>{title}</h3>
        {description && (
          <p className={styles.headerDescription}>{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export type CardFooterProps = HTMLAttributes<HTMLDivElement>;

export function CardFooter({
  className,
  children,
  ...props
}: CardFooterProps): ReactNode {
  return (
    <div className={`${styles.footer} ${className ?? ""}`} {...props}>
      {children}
    </div>
  );
}
