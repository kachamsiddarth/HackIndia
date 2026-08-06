"use client";

import React, { useState } from "react";
import { useExperienceMode } from "@/lib/experience/ExperienceContext";
import styles from "./ScreenReaderSimulator.module.css";

export function ScreenReaderSimulator(): React.ReactNode {
  const {
    screenReader,
    toggleScreenReader,
    toggleSpeech,
    setSpeechRate,
    clearTranscript,
  } = useExperienceMode();

  const [isMinimized, setIsMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState<"live" | "history" | "inspector">("live");

  if (!screenReader.enabled) return null;

  return (
    <div
      className={`${styles.simulatorPanel} ${isMinimized ? styles.minimized : ""}`}
      data-experience-panel="true"
    >
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <div className={styles.pulseDot} />
          <span>Screen Reader Simulation</span>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={toggleSpeech}
            title={screenReader.speechEnabled ? "Mute Speech Synth" : "Enable Speech Synth"}
          >
            {screenReader.speechEnabled ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="1" y1="1" x2="23" y2="23" />
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              </svg>
            )}
          </button>

          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? "Expand Panel" : "Minimize Panel"}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {isMinimized ? (
                <polyline points="18 15 12 9 6 15" />
              ) : (
                <polyline points="6 9 12 15 18 9" />
              )}
            </svg>
          </button>

          <button
            type="button"
            className={styles.iconBtn}
            onClick={toggleScreenReader}
            title="Turn Off Screen Reader Sim"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          <div className={styles.tabNav}>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === "live" ? styles.tabBtnActive : ""}`}
              onClick={() => setActiveTab("live")}
            >
              Live Speech
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === "history" ? styles.tabBtnActive : ""}`}
              onClick={() => setActiveTab("history")}
            >
              Transcript ({screenReader.transcriptHistory.length})
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === "inspector" ? styles.tabBtnActive : ""}`}
              onClick={() => setActiveTab("inspector")}
            >
              ARIA Inspector
            </button>
          </div>

          <div className={styles.content}>
            {activeTab === "live" && (
              <>
                <div className={styles.announcementCard}>
                  <div className={styles.announcementLabel}>Current Speech Readout</div>
                  <div className={styles.announcementText}>
                    {screenReader.currentAnnouncement ||
                      "Focus or click any button, link, or input element to trigger screen reader readout..."}
                  </div>
                </div>

                {screenReader.focusedElementDetails && (
                  <div className={styles.inspectorBox}>
                    <div className={styles.inspectorRow}>
                      <span className={styles.inspectorKey}>Element Tag</span>
                      <span className={styles.inspectorValue}>
                        &lt;{screenReader.focusedElementDetails.tag}&gt;
                      </span>
                    </div>
                    <div className={styles.inspectorRow}>
                      <span className={styles.inspectorKey}>Computed Role</span>
                      <span className={styles.inspectorValue}>
                        {screenReader.focusedElementDetails.role}
                      </span>
                    </div>
                    <div className={styles.inspectorRow}>
                      <span className={styles.inspectorKey}>Accessible Name</span>
                      <span className={styles.inspectorValue}>
                        {screenReader.focusedElementDetails.name}
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}

            {activeTab === "history" && (
              <div className={styles.transcriptList}>
                {screenReader.transcriptHistory.length === 0 ? (
                  <p style={{ fontSize: "12px", color: "#888", textAlign: "center" }}>
                    No transcript entries recorded yet.
                  </p>
                ) : (
                  screenReader.transcriptHistory.map((item) => (
                    <div key={item.id} className={styles.transcriptItem}>
                      <div className={styles.transcriptMeta}>
                        <span>{item.role || "announcement"}</span>
                        <span>{item.timestamp}</span>
                      </div>
                      <div>{item.text}</div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "inspector" && (
              <div className={styles.inspectorBox}>
                {screenReader.focusedElementDetails ? (
                  <>
                    <div className={styles.inspectorRow}>
                      <span className={styles.inspectorKey}>Tag Name</span>
                      <span className={styles.inspectorValue}>
                        {screenReader.focusedElementDetails.tag}
                      </span>
                    </div>
                    <div className={styles.inspectorRow}>
                      <span className={styles.inspectorKey}>Role</span>
                      <span className={styles.inspectorValue}>
                        {screenReader.focusedElementDetails.role}
                      </span>
                    </div>
                    <div className={styles.inspectorRow}>
                      <span className={styles.inspectorKey}>Name (Label)</span>
                      <span className={styles.inspectorValue}>
                        {screenReader.focusedElementDetails.name}
                      </span>
                    </div>
                    {screenReader.focusedElementDetails.value && (
                      <div className={styles.inspectorRow}>
                        <span className={styles.inspectorKey}>Value</span>
                        <span className={styles.inspectorValue}>
                          {screenReader.focusedElementDetails.value}
                        </span>
                      </div>
                    )}
                    {Object.keys(screenReader.focusedElementDetails.ariaAttributes).length > 0 ? (
                      Object.entries(screenReader.focusedElementDetails.ariaAttributes).map(
                        ([attr, val]) => (
                          <div key={attr} className={styles.inspectorRow}>
                            <span className={styles.inspectorKey}>{attr}</span>
                            <span className={styles.inspectorValue}>{val}</span>
                          </div>
                        )
                      )
                    ) : (
                      <div style={{ fontSize: "11px", color: "#888", marginTop: "4px" }}>
                        No explicit ARIA attributes present on element.
                      </div>
                    )}
                  </>
                ) : (
                  <p style={{ fontSize: "12px", color: "#888", textAlign: "center" }}>
                    Focus an element to inspect its ARIA properties.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className={styles.footer}>
            <div className={styles.rateSelector}>
              <span style={{ color: "#aaa" }}>Speed:</span>
              {[0.75, 1.0, 1.25, 1.5].map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`${styles.rateBtn} ${screenReader.rate === r ? styles.rateBtnActive : ""}`}
                  onClick={() => setSpeechRate(r)}
                >
                  {r}x
                </button>
              ))}
            </div>

            {activeTab === "history" && (
              <button
                type="button"
                className={styles.rateBtn}
                onClick={clearTranscript}
              >
                Clear Log
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
