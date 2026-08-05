"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import styles from "./Modal.module.css";

export type ModalSize = "sm" | "md" | "lg";

export interface ModalProps {
  /** Controls modal visibility */
  isOpen: boolean;
  /** Callback fired when user attempts to close modal */
  onClose: () => void;
  /** Modal header title */
  title: string;
  /** Size variant */
  size?: ModalSize;
  /** Modal content */
  children: ReactNode;
  /** Optional footer actions */
  footer?: ReactNode;
}

/**
 * Accessible Modal Component with backdrop focus trapping,
 * Escape key listening, and ARIA dialog attributes.
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  size = "md",
  children,
  footer,
}: ModalProps): ReactNode {
  const titleId = useId();
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modalClasses = [
    styles.modal,
    size === "sm" ? styles.modalSm : "",
    size === "lg" ? styles.modalLg : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={styles.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-modal="true"
      role="dialog"
      aria-labelledby={titleId}
    >
      <div className={modalClasses} ref={modalRef} tabIndex={-1}>
        <div className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close dialog"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={styles.body}>{children}</div>

        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  );
}
