import { type HTMLAttributes, type ReactNode } from "react";
import styles from "./Skeleton.module.css";

export type SkeletonVariant = "text" | "circular" | "rectangular";

export interface SkeletonProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: SkeletonVariant;
  width?: string | number;
  height?: string | number;
}

/**
 * Accessible Skeleton loading placeholder component.
 */
export default function Skeleton({
  variant = "text",
  width,
  height,
  className,
  style,
  ...props
}: SkeletonProps): ReactNode {
  const customStyle = {
    width: typeof width === "number" ? `${width}px` : width,
    height: typeof height === "number" ? `${height}px` : height,
    ...style,
  };

  const classNames = [
    styles.skeleton,
    styles[variant],
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      className={classNames}
      style={customStyle}
      aria-hidden="true"
      {...props}
    />
  );
}
