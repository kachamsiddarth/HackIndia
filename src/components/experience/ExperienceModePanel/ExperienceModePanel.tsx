"use client";

import React from "react";
import {
  useExperienceMode,
  type HighContrastMode,
  type ColorBlindnessMode,
} from "@/lib/experience/ExperienceContext";
import styles from "./ExperienceModePanel.module.css";

export function ExperienceModePanel(): React.ReactNode {
  const {
    highContrast,
    setHighContrast,
    colorBlindness,
    setColorBlindness,
    screenReader,
    toggleScreenReader,
    keyboardNav,
    toggleKeyboardNav,
    toggleTabOrder,
    visionAssist,
    setFontScale,
    setCursorScale,
    setLineSpacing,
    applyPreset,
    isPanelOpen,
    setPanelOpen,
  } = useExperienceMode();

  const activeFeaturesCount =
    (highContrast !== "off" ? 1 : 0) +
    (colorBlindness !== "none" ? 1 : 0) +
    (screenReader.enabled ? 1 : 0) +
    (keyboardNav.enabled ? 1 : 0) +
    (visionAssist.fontScale > 100 ? 1 : 0) +
    (visionAssist.cursorScale === "large" ? 1 : 0);

  return (
    <>
      {/* Floating Trigger Widget */}
      <button
        type="button"
        className={styles.floatingTrigger}
        onClick={() => setPanelOpen(!isPanelOpen)}
        title="Toggle Accessibility Experience Mode Panel"
        aria-expanded={isPanelOpen}
        data-experience-panel="true"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v8M8 12h8" />
        </svg>
        <span>Experience Mode</span>
        {activeFeaturesCount > 0 && (
          <span className={styles.activeBadge}>{activeFeaturesCount} Active</span>
        )}
      </button>

      {/* Drawer Overlay */}
      {isPanelOpen && (
        <div
          className={styles.drawerOverlay}
          onClick={() => setPanelOpen(false)}
          aria-hidden="true"
        >
          <div
            className={styles.drawer}
            onClick={(e) => e.stopPropagation()}
            data-experience-panel="true"
            role="dialog"
            aria-label="Accessibility Experience Mode Controls"
          >
            <div className={styles.drawerHeader}>
              <div className={styles.drawerTitle}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent, #ff9d2e)" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                Experience Mode Settings
              </div>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setPanelOpen(false)}
                aria-label="Close Experience Mode Panel"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className={styles.drawerContent}>
              {/* Presets */}
              <div className={styles.section}>
                <div className={styles.sectionTitle}>
                  <span>⚡</span> Quick Experience Presets
                </div>
                <div className={styles.presetGrid}>
                  <button
                    type="button"
                    className={styles.presetCard}
                    onClick={() => applyPreset("default")}
                  >
                    <div className={styles.presetName}>Standard Mode</div>
                    <div className={styles.presetDesc}>Default visual theme</div>
                  </button>
                  <button
                    type="button"
                    className={styles.presetCard}
                    onClick={() => applyPreset("screen-reader")}
                  >
                    <div className={styles.presetName}>Screen Reader</div>
                    <div className={styles.presetDesc}>Speech synth & speech HUD</div>
                  </button>
                  <button
                    type="button"
                    className={styles.presetCard}
                    onClick={() => applyPreset("low-vision")}
                  >
                    <div className={styles.presetName}>Low Vision AAA</div>
                    <div className={styles.presetDesc}>125% scale & High Contrast</div>
                  </button>
                  <button
                    type="button"
                    className={styles.presetCard}
                    onClick={() => applyPreset("keyboard-only")}
                  >
                    <div className={styles.presetName}>Keyboard Only</div>
                    <div className={styles.presetDesc}>Tab order overlay & tracer</div>
                  </button>
                </div>
              </div>

              {/* High Contrast */}
              <div className={styles.section}>
                <div className={styles.sectionTitle}>
                  <span>🌓</span> High Contrast (WCAG AAA)
                </div>
                <div className={styles.segmentedControl}>
                  {(["off", "dark", "light"] as HighContrastMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={`${styles.segmentedBtn} ${highContrast === mode ? styles.segmentedBtnActive : ""}`}
                      onClick={() => setHighContrast(mode)}
                    >
                      {mode === "off" ? "Off" : mode === "dark" ? "High Dark" : "High Light"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Blindness */}
              <div className={styles.section}>
                <div className={styles.sectionTitle}>
                  <span>🎨</span> Color Blindness Simulation
                </div>
                <div className={styles.segmentedControl} style={{ flexWrap: "wrap" }}>
                  {(
                    [
                      { id: "none", label: "None" },
                      { id: "protanopia", label: "Protan" },
                      { id: "deuteranopia", label: "Deuter" },
                      { id: "tritanopia", label: "Tritan" },
                      { id: "achromatopsia", label: "Mono" },
                    ] as { id: ColorBlindnessMode; label: string }[]
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`${styles.segmentedBtn} ${colorBlindness === item.id ? styles.segmentedBtnActive : ""}`}
                      onClick={() => setColorBlindness(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Screen Reader */}
              <div className={styles.section}>
                <div className={styles.sectionTitle}>
                  <span>🗣️</span> Screen Reader Simulation
                </div>
                <div className={styles.toggleRow}>
                  <div className={styles.toggleInfo}>
                    <div className={styles.toggleTitle}>Screen Reader Speech Synth</div>
                    <div className={styles.toggleDesc}>
                      Announces focused tag, role, and text using Web Speech
                    </div>
                  </div>
                  <div
                    className={`${styles.switch} ${screenReader.enabled ? styles.switchChecked : ""}`}
                    onClick={toggleScreenReader}
                  >
                    <div className={styles.switchHandle} />
                  </div>
                </div>
              </div>

              {/* Keyboard Nav */}
              <div className={styles.section}>
                <div className={styles.sectionTitle}>
                  <span>⌨️</span> Keyboard Focus Inspector
                </div>
                <div className={styles.toggleRow}>
                  <div className={styles.toggleInfo}>
                    <div className={styles.toggleTitle}>Keyboard Navigation Mode</div>
                    <div className={styles.toggleDesc}>
                      Enforces high contrast focus outline and tab tracer
                    </div>
                  </div>
                  <div
                    className={`${styles.switch} ${keyboardNav.enabled ? styles.switchChecked : ""}`}
                    onClick={toggleKeyboardNav}
                  >
                    <div className={styles.switchHandle} />
                  </div>
                </div>

                {keyboardNav.enabled && (
                  <div className={styles.toggleRow} style={{ marginTop: "4px" }}>
                    <div className={styles.toggleInfo}>
                      <div className={styles.toggleTitle}>Show Tab Order Badges</div>
                      <div className={styles.toggleDesc}>
                        Render #1, #2... over focusable DOM nodes
                      </div>
                    </div>
                    <div
                      className={`${styles.switch} ${keyboardNav.showTabOrder ? styles.switchChecked : ""}`}
                      onClick={toggleTabOrder}
                    >
                      <div className={styles.switchHandle} />
                    </div>
                  </div>
                )}
              </div>

              {/* Vision Assist */}
              <div className={styles.section}>
                <div className={styles.sectionTitle}>
                  <span>🔍</span> Vision & Reading Assist
                </div>

                <div className={styles.optionGroup}>
                  <div className={styles.optionLabel}>Text Zoom Level: {visionAssist.fontScale}%</div>
                  <div className={styles.segmentedControl}>
                    {([100, 110, 125, 140, 150] as (100 | 110 | 125 | 140 | 150)[]).map(
                      (scale) => (
                        <button
                          key={scale}
                          type="button"
                          className={`${styles.segmentedBtn} ${visionAssist.fontScale === scale ? styles.segmentedBtnActive : ""}`}
                          onClick={() => setFontScale(scale)}
                        >
                          {scale}%
                        </button>
                      )
                    )}
                  </div>
                </div>

                <div className={styles.optionGroup} style={{ marginTop: "8px" }}>
                  <div className={styles.optionLabel}>Line & Word Spacing</div>
                  <div className={styles.segmentedControl}>
                    {(["normal", "relaxed", "loose"] as ("normal" | "relaxed" | "loose")[]).map(
                      (sp) => (
                        <button
                          key={sp}
                          type="button"
                          className={`${styles.segmentedBtn} ${visionAssist.lineSpacing === sp ? styles.segmentedBtnActive : ""}`}
                          onClick={() => setLineSpacing(sp)}
                        >
                          {sp.charAt(0).toUpperCase() + sp.slice(1)}
                        </button>
                      )
                    )}
                  </div>
                </div>

                <div className={styles.toggleRow} style={{ marginTop: "8px" }}>
                  <div className={styles.toggleInfo}>
                    <div className={styles.toggleTitle}>Large Accessibility Cursor</div>
                    <div className={styles.toggleDesc}>Enlarged high contrast cursor pointer</div>
                  </div>
                  <div
                    className={`${styles.switch} ${visionAssist.cursorScale === "large" ? styles.switchChecked : ""}`}
                    onClick={() =>
                      setCursorScale(visionAssist.cursorScale === "large" ? "normal" : "large")
                    }
                  >
                    <div className={styles.switchHandle} />
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.drawerFooter}>
              <button
                type="button"
                className={styles.resetBtn}
                onClick={() => applyPreset("default")}
              >
                Reset All Settings
              </button>
              <span style={{ fontSize: "11px", color: "#888" }}>AccessDiff WCAG 2.2 Suite</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
