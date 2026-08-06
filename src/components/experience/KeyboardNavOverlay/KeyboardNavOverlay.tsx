"use client";

import React, { useEffect, useState } from "react";
import { useExperienceMode } from "@/lib/experience/ExperienceContext";
import styles from "./KeyboardNavOverlay.module.css";

interface FocusableRect {
  id: number;
  top: number;
  left: number;
  width: number;
  height: number;
  tagName: string;
  isFocused: boolean;
}

export function KeyboardNavOverlay(): React.ReactNode {
  const { keyboardNav, focusNextElement, focusPrevElement, toggleTabOrder } =
    useExperienceMode();
  const [rects, setRects] = useState<FocusableRect[]>([]);

  useEffect(() => {
    if (!keyboardNav.enabled || !keyboardNav.showTabOrder) {
      // This legacy global overlay is no longer mounted. Keep its state clean
      // if it is reused independently in the future.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRects([]);
      return;
    }

    const updateRects = () => {
      const elements = Array.from(
        document.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter(
        (el) =>
          el.offsetParent !== null &&
          !el.closest("[data-experience-panel]") &&
          !el.closest("." + styles.controlBar)
      );

      const activeEl = document.activeElement;

      const newRects: FocusableRect[] = elements.map((el, idx) => {
        const r = el.getBoundingClientRect();
        return {
          id: idx + 1,
          top: r.top + window.scrollY,
          left: r.left + window.scrollX,
          width: r.width,
          height: r.height,
          tagName: el.tagName.toLowerCase(),
          isFocused: el === activeEl,
        };
      });

      setRects(newRects);
    };

    updateRects();
    window.addEventListener("resize", updateRects);
    window.addEventListener("scroll", updateRects, true);
    document.addEventListener("focusin", updateRects);

    const observer = new MutationObserver(updateRects);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener("resize", updateRects);
      window.removeEventListener("scroll", updateRects, true);
      document.removeEventListener("focusin", updateRects);
      observer.disconnect();
    };
  }, [keyboardNav.enabled, keyboardNav.showTabOrder]);

  if (!keyboardNav.enabled) return null;

  return (
    <>
      {keyboardNav.showTabOrder && rects.length > 0 && (
        <div className={styles.container} aria-hidden="true">
          {rects.map((r) => (
            <div
              key={r.id}
              className={`${styles.badge} ${r.isFocused ? styles.badgeActive : ""}`}
              style={{
                top: `${r.top}px`,
                left: `${r.left}px`,
              }}
            >
              #{r.id} ({r.tagName})
            </div>
          ))}
        </div>
      )}

      <div className={styles.controlBar} data-experience-panel="true">
        <div className={styles.title}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M18 12h.01M8 16h8" />
          </svg>
          Keyboard Nav
        </div>

        <span className={styles.badgeCount}>
          {keyboardNav.focusableElementsCount} Focusable Elements
        </span>

        <button
          type="button"
          className={styles.btn}
          onClick={toggleTabOrder}
          title="Toggle visual numbers on focusable elements"
        >
          {keyboardNav.showTabOrder ? "Hide Numbers" : "Show Tab Order"}
        </button>

        <button
          type="button"
          className={styles.btn}
          onClick={focusPrevElement}
          title="Step to previous focusable element (Shift+Tab)"
        >
          &larr; Prev
        </button>

        <button
          type="button"
          className={styles.btn}
          onClick={focusNextElement}
          title="Step to next focusable element (Tab)"
        >
          Next &rarr;
        </button>
      </div>
    </>
  );
}
