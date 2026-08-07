"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import styles from "./KeyboardShortcutProvider.module.css";

/**
 * Tracks whether the active document element is a typable control.
 * Used so Ctrl+Alt+V does not toggle the voice assistant while the user
 * is actively typing — that would steal focus or erase input state.
 */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export type VoiceRecordingState = "idle" | "listening" | "processing";

export interface KeyboardShortcutContextValue {
  /** Announce an arbitrary string via the global aria-live region. */
  announce: (message: string, politeness?: "polite" | "assertive") => void;
  /** Subscribe with the component that actually drives the mic. */
  registerToggleVoice: (toggle: () => void) => () => void;
  /** Called by the voice component whenever its state changes so the
   *  provider can mirror it (keeps announcements + keyboard + FAB in sync). */
  setVoiceState: (state: VoiceRecordingState) => void;
  /** Current mirrored voice state. */
  voiceState: VoiceRecordingState;
  /** Fire a synthetic toggle (used for first-launch / testing). */
  requestToggle: () => void;
}

const KeyboardShortcutContext = createContext<KeyboardShortcutContextValue | null>(null);

const STORAGE_FIRST_LAUNCH_KEY = "accessdiff.a11y-intro-shown-v2";

/**
 * Human-readable shortcut label used in announcements, screen-reader hints,
 * and on-screen shortcut badges.  Ctrl + Alt + V was chosen because:
 *   - Alt + Space is the native Windows "System Menu" accelerator
 *     (Restore / Move / Size / Minimize / Close) and Chromium on Windows
 *     still fires it even after `preventDefault()` in the keydown handler.
 *   - Ctrl + Alt + V collides with no OS / Chrome / Edge / Firefox default
 *     binding on Windows, Linux, or macOS, and "V" is a natural mnemonic
 *     for "Voice".
 */
const SHORTCUT_DISPLAY = "Ctrl + Alt + V";

export function KeyboardShortcutProvider({ children }: { children: ReactNode }) {
  const [voiceState, setVoiceState] = useState<VoiceRecordingState>("idle");
  const [politeMsg, setPoliteMsg] = useState("");
  const [assertiveMsg, setAssertiveMsg] = useState("");

  const toggleRef = useRef<(() => void) | null>(null);
  const politeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assertiveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const announcedRef = useRef<Set<string>>(new Set());

  const announce = useCallback(
    (message: string, politeness: "polite" | "assertive" = "polite") => {
      if (!message) return;
      // Cycle the value so screen readers re-fire even if the same text
      // is announced twice in a row.
      const key = `${politeness}:${message}`;
      const setter = politeness === "assertive" ? setAssertiveMsg : setPoliteMsg;
      setter(" ");
      // Defer so browsers perceive a real change to the live-region text.
      const timer = politeness === "assertive" ? assertiveTimer : politeTimer;
      if (timer.current) clearTimeout(timer.current);
      const t = setTimeout(() => setter(message), 30);
      if (politeness === "assertive") assertiveTimer.current = t;
      else politeTimer.current = t;
      announcedRef.current.add(key);
    },
    []
  );

  const registerToggleVoice = useCallback((toggle: () => void) => {
    toggleRef.current = toggle;
    return () => {
      if (toggleRef.current === toggle) toggleRef.current = null;
    };
  }, []);

  const requestToggle = useCallback(() => {
    if (toggleRef.current) {
      try {
        toggleRef.current();
      } catch {
        // Voice component not ready yet, ignore.
      }
    }
  }, []);

  // Ctrl + Alt + V global shortcut ------------------------------------------------
  useEffect(() => {
    function onKeyDown(ev: KeyboardEvent) {
      // Require both Ctrl AND Alt as modifiers (Mac users will get this via
      // their Ctrl-Option equivalent, which is how the browser maps it).
      if (!ev.ctrlKey || !ev.altKey) return;
      // Accept both the layout-independent `code === "KeyV"` AND the
      // character check so non-US keyboards where V is on a different
      // physical key still work.
      const isV = ev.code === "KeyV" || ev.key === "v" || ev.key === "V";
      if (!isV) return;
      if (isTypingTarget(ev.target)) return;
      // Prevent any default browser action that might be mapped to this
      // chord (none today, but defensively avoid surprises).
      ev.preventDefault();
      ev.stopPropagation();
      requestToggle();
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [requestToggle]);

  // Whenever the voice component updates our mirrored state, announce the
  // corresponding transition so screen readers keep up with the UI.
  const lastAnnouncedState = useRef<VoiceRecordingState>("idle");
  useEffect(() => {
    if (voiceState === lastAnnouncedState.current) return;
    if (voiceState === "listening" && lastAnnouncedState.current !== "listening") {
      announce("Voice assistant activated. Listening.", "assertive");
    } else if (voiceState === "idle" && lastAnnouncedState.current === "listening") {
      announce("Voice assistant stopped.", "polite");
    }
    lastAnnouncedState.current = voiceState;
  }, [voiceState, announce]);

  // First-launch of Accessibility Mode: announce how to activate voice control.
  // Uses sessionStorage so each new dashboard session re-announces it.
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      if (window.sessionStorage.getItem(STORAGE_FIRST_LAUNCH_KEY) === "1") return;
      window.sessionStorage.setItem(STORAGE_FIRST_LAUNCH_KEY, "1");
    } catch {
      // No-op if storage is unavailable (private mode / blocked).
    }
    // Defer to ensure the rest of the app mounts + the live region exists.
    const t = setTimeout(
      () =>
        announce(
          `Accessibility Mode enabled. Press ${SHORTCUT_DISPLAY} at any time to activate voice control.`,
          "polite"
        ),
      1500
    );
    return () => clearTimeout(t);
  }, [announce]);

  const value = useMemo<KeyboardShortcutContextValue>(
    () => ({
      announce,
      registerToggleVoice,
      setVoiceState,
      voiceState,
      requestToggle,
    }),
    [announce, registerToggleVoice, voiceState, requestToggle]
  );

  return (
    <KeyboardShortcutContext.Provider value={value}>
      {/*
        Two visually-hidden live regions: polite for non-urgent text,
        assertive for state changes that must interrupt the user.
        Separate elements so their announcement queues do not clobber each
        other when transitioning rapidly between states.
      */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-relevant="additions text"
        className={styles.visuallyHidden}
        id="accessdiff-a11y-live-polite"
      >
        {politeMsg}
      </div>
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        aria-relevant="additions text"
        className={styles.visuallyHidden}
        id="accessdiff-a11y-live-assertive"
      >
        {assertiveMsg}
      </div>

      {/*
        Hidden keyboard help: discoverable via screen reader and the
        documented Accessibility Mode help pages. Always present so
        users that use element listing can find the shortcut.
      */}
      <div className={styles.visuallyHidden} aria-hidden="false">
        <span>Global keyboard shortcuts: Ctrl plus Alt plus V toggles the Sarvam voice assistant.</span>
      </div>

      {children}
    </KeyboardShortcutContext.Provider>
  );
}

/**
 * Hook for components that want to announce text, subscribe to the voice
 * shortcut, or push the current voice state up into the provider so the
 * global keyboard route can announce consistent state transitions.
 */
export function useKeyboardShortcuts(): KeyboardShortcutContextValue {
  const ctx = useContext(KeyboardShortcutContext);
  if (!ctx) {
    // Graceful fallback for previews / tests outside the provider shell.
    // Return a no-op stub so the component tree still renders.
    return {
      announce: () => {},
      registerToggleVoice: () => () => {},
      setVoiceState: () => {},
      voiceState: "idle",
      requestToggle: () => {},
    };
  }
  return ctx;
}
