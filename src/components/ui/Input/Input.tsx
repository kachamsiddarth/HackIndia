"use client";

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import styles from "./Input.module.css";

export type InputSize = "sm" | "md" | "lg";

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** Visible label text (required for accessibility) */
  label: string;
  /** Optional description text below the label */
  description?: string;
  /** Error message — shows error state when provided */
  error?: string;
  /** Size preset */
  size?: InputSize;
  /** Icon element to render on the left */
  leftIcon?: ReactNode;
  /** Icon element to render on the right */
  rightIcon?: ReactNode;
  /** Hide the label visually (still available to screen readers) */
  hideLabel?: boolean;
  /** Whether the field is required */
  required?: boolean;
}

/**
 * Accessible text input component with visible label, error state,
 * and optional icon slots.
 */
const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      description,
      error,
      size = "md",
      leftIcon,
      rightIcon,
      hideLabel = false,
      required = false,
      className,
      id: providedId,
      ...props
    },
    ref
  ): ReactNode => {
    const generatedId = useId();
    const inputId = providedId ?? generatedId;
    const descriptionId = description ? `${inputId}-desc` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;

    const containerClasses = [
      styles.inputContainer,
      styles[size],
      leftIcon ? styles.hasLeftIcon : "",
      rightIcon ? styles.hasRightIcon : "",
    ]
      .filter(Boolean)
      .join(" ");

    const inputClasses = [
      styles.input,
      styles[size],
      error ? styles.inputError : "",
      className ?? "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div className={styles.inputWrapper}>
        <label
          htmlFor={inputId}
          className={hideLabel ? "sr-only" : styles.label}
        >
          {label}
          {required && (
            <span className={styles.required} aria-hidden="true">
              *
            </span>
          )}
        </label>

        {description && (
          <p id={descriptionId} className={styles.description}>
            {description}
          </p>
        )}

        <div className={containerClasses}>
          {leftIcon && (
            <span className={styles.leftIcon} aria-hidden="true">
              {leftIcon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            className={inputClasses}
            aria-invalid={error ? true : undefined}
            aria-describedby={
              [descriptionId, errorId].filter(Boolean).join(" ") || undefined
            }
            aria-required={required || undefined}
            {...props}
          />

          {rightIcon && (
            <span className={styles.rightIcon} aria-hidden="true">
              {rightIcon}
            </span>
          )}
        </div>

        {error && (
          <p id={errorId} className={styles.errorMessage} role="alert">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
export default Input;
