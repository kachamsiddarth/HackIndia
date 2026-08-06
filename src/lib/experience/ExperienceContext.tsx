"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

export type HighContrastMode = "off" | "dark" | "light";
export type ColorBlindnessMode =
  | "none"
  | "protanopia"
  | "deuteranopia"
  | "tritanopia"
  | "achromatopsia";

export interface TranscriptItem {
  id: string;
  text: string;
  timestamp: string;
  role?: string;
}

export interface FocusedElementInfo {
  tag: string;
  role: string;
  name: string;
  value?: string;
  ariaAttributes: Record<string, string>;
}

export interface ScreenReaderState {
  enabled: boolean;
  speechEnabled: boolean;
  rate: number;
  currentAnnouncement: string | null;
  focusedElementDetails: FocusedElementInfo | null;
  transcriptHistory: TranscriptItem[];
}

export interface KeyboardNavState {
  enabled: boolean;
  showTabOrder: boolean;
  activeFocusIndex: number | null;
  focusableElementsCount: number;
}

export interface VisionAssistState {
  fontScale: 100 | 110 | 125 | 140 | 150;
  cursorScale: "normal" | "large";
  lineSpacing: "normal" | "relaxed" | "loose";
}

export interface ExperienceContextType {
  highContrast: HighContrastMode;
  setHighContrast: (mode: HighContrastMode) => void;
  colorBlindness: ColorBlindnessMode;
  setColorBlindness: (mode: ColorBlindnessMode) => void;
  screenReader: ScreenReaderState;
  toggleScreenReader: () => void;
  toggleSpeech: () => void;
  setSpeechRate: (rate: number) => void;
  clearTranscript: () => void;
  announce: (text: string, role?: string) => void;
  keyboardNav: KeyboardNavState;
  toggleKeyboardNav: () => void;
  toggleTabOrder: () => void;
  focusNextElement: () => void;
  focusPrevElement: () => void;
  visionAssist: VisionAssistState;
  setFontScale: (scale: 100 | 110 | 125 | 140 | 150) => void;
  setCursorScale: (scale: "normal" | "large") => void;
  setLineSpacing: (spacing: "normal" | "relaxed" | "loose") => void;
  applyPreset: (
    preset: "default" | "screen-reader" | "low-vision" | "keyboard-only" | "color-blind"
  ) => void;
  isPanelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
}

const ExperienceContext = createContext<ExperienceContextType | undefined>(undefined);

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function ExperienceProvider({ children }: { children: ReactNode }) {
  const [highContrast, setHighContrast] = useState<HighContrastMode>("off");
  const [colorBlindness, setColorBlindness] = useState<ColorBlindnessMode>("none");

  const [screenReader, setScreenReader] = useState<ScreenReaderState>({
    enabled: false,
    speechEnabled: true,
    rate: 1.0,
    currentAnnouncement: null,
    focusedElementDetails: null,
    transcriptHistory: [],
  });

  const [keyboardNav, setKeyboardNav] = useState<KeyboardNavState>({
    enabled: false,
    showTabOrder: false,
    activeFocusIndex: null,
    focusableElementsCount: 0,
  });

  const [visionAssist, setVisionAssist] = useState<VisionAssistState>({
    fontScale: 100,
    cursorScale: "normal",
    lineSpacing: "normal",
  });

  const [isPanelOpen, setPanelOpen] = useState(false);

  // Synchronize CSS classes on document element when contrast/vision settings change
  useEffect(() => {
    const root = document.documentElement;

    // High Contrast classes
    root.classList.remove("exp-contrast-dark", "exp-contrast-light");
    if (highContrast === "dark") root.classList.add("exp-contrast-dark");
    if (highContrast === "light") root.classList.add("exp-contrast-light");

    // Color Blindness classes
    root.classList.remove(
      "exp-filter-protanopia",
      "exp-filter-deuteranopia",
      "exp-filter-tritanopia",
      "exp-filter-achromatopsia"
    );
    if (colorBlindness !== "none") {
      root.classList.add(`exp-filter-${colorBlindness}`);
    }

    // Font Scale classes
    root.classList.remove(
      "exp-font-110",
      "exp-font-125",
      "exp-font-140",
      "exp-font-150"
    );
    if (visionAssist.fontScale > 100) {
      root.classList.add(`exp-font-${visionAssist.fontScale}`);
    }

    // Line Spacing classes
    root.classList.remove("exp-spacing-relaxed", "exp-spacing-loose");
    if (visionAssist.lineSpacing !== "normal") {
      root.classList.add(`exp-spacing-${visionAssist.lineSpacing}`);
    }

    // Cursor Scale classes
    root.classList.remove("exp-cursor-large");
    if (visionAssist.cursorScale === "large") {
      root.classList.add("exp-cursor-large");
    }

    // Keyboard Nav class
    if (keyboardNav.enabled) {
      root.classList.add("exp-keyboard-active");
    } else {
      root.classList.remove("exp-keyboard-active");
    }
  }, [highContrast, colorBlindness, visionAssist, keyboardNav.enabled]);

  // Speech Synth Utterance helper
  const speakText = useCallback(
    (text: string, rate: number) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = rate;
      utterance.lang = "en-US";
      window.speechSynthesis.speak(utterance);
    },
    []
  );

  // Announce helper function
  const announce = useCallback(
    (text: string, role?: string) => {
      const timeStr = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      const newItem: TranscriptItem = {
        id: `${Date.now()}-${Math.random()}`,
        text,
        timestamp: timeStr,
        role,
      };

      setScreenReader((prev) => ({
        ...prev,
        currentAnnouncement: text,
        transcriptHistory: [newItem, ...prev.transcriptHistory].slice(0, 50),
      }));

      if (screenReader.enabled && screenReader.speechEnabled) {
        speakText(text, screenReader.rate);
      }
    },
    [screenReader.enabled, screenReader.speechEnabled, screenReader.rate, speakText]
  );

  // Screen Reader DOM Focus Listener
  useEffect(() => {
    if (!screenReader.enabled) return;

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (!target || target.closest("[data-experience-panel]")) return;

      const tag = target.tagName.toLowerCase();
      let role = target.getAttribute("role") || "";
      if (!role) {
        if (tag === "button") role = "button";
        else if (tag === "a") role = "link";
        else if (tag === "input") role = target.getAttribute("type") || "textbox";
        else if (tag === "select") role = "combobox";
        else if (tag === "textarea") role = "textbox";
        else if (/^h[1-6]$/.test(tag)) role = `heading level ${tag[1]}`;
        else role = "interactive element";
      }

      // Name computation
      let name =
        target.getAttribute("aria-label") ||
        target.getAttribute("title") ||
        target.getAttribute("placeholder") ||
        target.innerText?.trim() ||
        "Unlabelled Element";
      if (name.length > 80) name = name.substring(0, 77) + "...";

      // Value & State
      const value = (target as HTMLInputElement).value || "";
      const states: string[] = [];

      if (target.getAttribute("aria-expanded") === "true") states.push("expanded");
      if (target.getAttribute("aria-expanded") === "false") states.push("collapsed");
      if (target.getAttribute("aria-checked") === "true") states.push("checked");
      if (target.getAttribute("aria-selected") === "true") states.push("selected");
      if ((target as HTMLInputElement).disabled) states.push("disabled");
      if (target.getAttribute("aria-disabled") === "true") states.push("disabled");
      if (target.getAttribute("aria-haspopup")) states.push("has pop up");

      // Build announcement text
      const announcementParts = [
        role.charAt(0).toUpperCase() + role.slice(1),
        `"${name}"`,
        value ? `value: ${value}` : "",
        states.join(", "),
      ].filter(Boolean);

      const announcementStr = announcementParts.join(", ");

      // Extract ARIA attributes for inspector
      const ariaAttributes: Record<string, string> = {};
      Array.from(target.attributes).forEach((attr) => {
        if (attr.name.startsWith("aria-")) {
          ariaAttributes[attr.name] = attr.value;
        }
      });

      setScreenReader((prev) => ({
        ...prev,
        focusedElementDetails: {
          tag,
          role,
          name,
          value,
          ariaAttributes,
        },
      }));

      announce(announcementStr, role);
    };

    document.addEventListener("focusin", handleFocusIn);
    return () => document.removeEventListener("focusin", handleFocusIn);
  }, [screenReader.enabled, announce]);

  // Keyboard navigation focus scanner
  useEffect(() => {
    if (!keyboardNav.enabled) return;

    const updateFocusableCount = () => {
      const elements = Array.from(
        document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => el.offsetParent !== null && !el.closest("[data-experience-panel]"));
      setKeyboardNav((prev) => ({ ...prev, focusableElementsCount: elements.length }));
    };

    updateFocusableCount();
    const observer = new MutationObserver(updateFocusableCount);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [keyboardNav.enabled]);

  // Actions
  const toggleScreenReader = () => {
    setScreenReader((prev) => {
      const nextEnabled = !prev.enabled;
      if (nextEnabled) {
        announce("Screen Reader Simulation Activated. Focus elements to hear audio playback.");
      } else {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
        }
      }
      return { ...prev, enabled: nextEnabled };
    });
  };

  const toggleSpeech = () => {
    setScreenReader((prev) => ({ ...prev, speechEnabled: !prev.speechEnabled }));
  };

  const setSpeechRate = (rate: number) => {
    setScreenReader((prev) => ({ ...prev, rate }));
  };

  const clearTranscript = () => {
    setScreenReader((prev) => ({ ...prev, transcriptHistory: [] }));
  };

  const toggleKeyboardNav = () => {
    setKeyboardNav((prev) => ({ ...prev, enabled: !prev.enabled }));
  };

  const toggleTabOrder = () => {
    setKeyboardNav((prev) => ({ ...prev, showTabOrder: !prev.showTabOrder }));
  };

  const getFocusableElements = (): HTMLElement[] => {
    if (typeof document === "undefined") return [];
    return Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
      (el) => el.offsetParent !== null && !el.closest("[data-experience-panel]")
    );
  };

  const focusNextElement = () => {
    const elements = getFocusableElements();
    if (elements.length === 0) return;
    const active = document.activeElement as HTMLElement;
    const currentIndex = elements.indexOf(active);
    const nextIndex = (currentIndex + 1) % elements.length;
    elements[nextIndex]?.focus();
    setKeyboardNav((prev) => ({ ...prev, activeFocusIndex: nextIndex }));
  };

  const focusPrevElement = () => {
    const elements = getFocusableElements();
    if (elements.length === 0) return;
    const active = document.activeElement as HTMLElement;
    const currentIndex = elements.indexOf(active);
    const prevIndex = currentIndex <= 0 ? elements.length - 1 : currentIndex - 1;
    elements[prevIndex]?.focus();
    setKeyboardNav((prev) => ({ ...prev, activeFocusIndex: prevIndex }));
  };

  const setFontScale = (scale: 100 | 110 | 125 | 140 | 150) => {
    setVisionAssist((prev) => ({ ...prev, fontScale: scale }));
  };

  const setCursorScale = (scale: "normal" | "large") => {
    setVisionAssist((prev) => ({ ...prev, cursorScale: scale }));
  };

  const setLineSpacing = (spacing: "normal" | "relaxed" | "loose") => {
    setVisionAssist((prev) => ({ ...prev, lineSpacing: spacing }));
  };

  const applyPreset = (
    preset: "default" | "screen-reader" | "low-vision" | "keyboard-only" | "color-blind"
  ) => {
    if (preset === "default") {
      setHighContrast("off");
      setColorBlindness("none");
      setScreenReader((prev) => ({ ...prev, enabled: false }));
      setKeyboardNav({ enabled: false, showTabOrder: false, activeFocusIndex: null, focusableElementsCount: 0 });
      setVisionAssist({ fontScale: 100, cursorScale: "normal", lineSpacing: "normal" });
      announce("Reset to Default Standard Mode");
    } else if (preset === "screen-reader") {
      setScreenReader((prev) => ({ ...prev, enabled: true, speechEnabled: true }));
      setKeyboardNav((prev) => ({ ...prev, enabled: true, showTabOrder: true }));
      announce("Preset Applied: Screen Reader User Experience");
    } else if (preset === "low-vision") {
      setHighContrast("dark");
      setVisionAssist({ fontScale: 125, cursorScale: "large", lineSpacing: "relaxed" });
      announce("Preset Applied: Low Vision & High Contrast AAA");
    } else if (preset === "keyboard-only") {
      setKeyboardNav({ enabled: true, showTabOrder: true, activeFocusIndex: null, focusableElementsCount: 0 });
      announce("Preset Applied: Keyboard Navigation & Tab Inspector");
    } else if (preset === "color-blind") {
      setColorBlindness("deuteranopia");
      announce("Preset Applied: Deuteranopia Color Deficiency Filter");
    }
  };

  return (
    <ExperienceContext.Provider
      value={{
        highContrast,
        setHighContrast,
        colorBlindness,
        setColorBlindness,
        screenReader,
        toggleScreenReader,
        toggleSpeech,
        setSpeechRate,
        clearTranscript,
        announce,
        keyboardNav,
        toggleKeyboardNav,
        toggleTabOrder,
        focusNextElement,
        focusPrevElement,
        visionAssist,
        setFontScale,
        setCursorScale,
        setLineSpacing,
        applyPreset,
        isPanelOpen,
        setPanelOpen,
      }}
    >
      {children}
    </ExperienceContext.Provider>
  );
}

export function useExperienceMode() {
  const context = useContext(ExperienceContext);
  if (!context) {
    throw new Error("useExperienceMode must be used within an ExperienceProvider");
  }
  return context;
}
