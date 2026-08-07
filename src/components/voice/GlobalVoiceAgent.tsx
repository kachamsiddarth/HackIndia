"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import styles from "./GlobalVoiceAgent.module.css";

export function GlobalVoiceAgent() {
  const [isOpen, setIsOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [lastReply, setLastReply] = useState<string | null>(null);
  const [language, setLanguage] = useState<string>("en-IN");

  const recognitionRef = useRef<any>(null);
  const pathname = usePathname();

  // Extract project/repo context from current URL if available
  const extractContextFromUrl = () => {
    const segments = pathname.split("/").filter(Boolean);
    let projectId: string | undefined;
    if (segments[0] === "projects" && segments[1]) {
      projectId = segments[1];
    }
    return {
      currentPath: pathname,
      projectId,
    };
  };

  const speakText = async (text: string) => {
    try {
      const res = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "tts",
          text: text.slice(0, 400),
          language,
        }),
      });
      const json = await res.json();
      if (json.data?.audioBase64) {
        const audio = new Audio(`data:audio/wav;base64,${json.data.audioBase64}`);
        await audio.play();
        return;
      }
    } catch {
      // Fallback to Web Speech API
    }

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleCommandSend = async (commandText: string) => {
    if (!commandText.trim() || processing) return;
    setProcessing(true);
    setTranscript(commandText);

    try {
      const context = extractContextFromUrl();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: commandText,
          language,
          projectId: context.projectId,
          context,
        }),
      });

      const json = await res.json();
      const reply = json.data?.reply || json.error?.message || "Command executed.";
      setLastReply(reply);

      // Play audio confirmation via Sarvam TTS
      void speakText(reply);

      // Execute autonomous navigation if requested by Sarvam Agent
      if (json.data?.navigationTarget) {
        setTimeout(() => {
          window.location.href = json.data.navigationTarget;
        }, 2000);
      }
    } catch {
      setLastReply("Failed to execute voice command. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const transcriptRef = useRef("");

  const toggleRecording = () => {
    if (recording) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setRecording(false);
      return;
    }

    if (typeof window === "undefined") return;

    const SpeechRecognitionWindow =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionWindow) {
      alert("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
      return;
    }

    try {
      const recognition = new SpeechRecognitionWindow();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = language;

      recognitionRef.current = recognition;
      setTranscript("");
      transcriptRef.current = "";

      recognition.onresult = (event: any) => {
        let text = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          text += event.results[i][0].transcript;
        }
        setTranscript(text);
        transcriptRef.current = text;
      };

      recognition.onerror = () => setRecording(false);
      recognition.onend = () => {
        setRecording(false);
        const finalCmd = transcriptRef.current.trim();
        if (finalCmd) {
          void handleCommandSend(finalCmd);
        }
      };

      recognition.start();
      setRecording(true);
      setIsOpen(true);
    } catch {
      setRecording(false);
    }
  };

  return (
    <div className={styles.container}>
      {isOpen && (
        <div className={styles.popover}>
          <div className={styles.popoverHeader}>
            <span className={styles.title}>🎙️ Sarvam AI Operator</span>
            <button className={styles.closeBtn} onClick={() => setIsOpen(false)}>
              ✕
            </button>
          </div>

          <div className={styles.popoverBody}>
            <div className={styles.langRow}>
              <label>Language:</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className={styles.langSelect}
              >
                <option value="en-IN">English</option>
                <option value="hi-IN">Hindi (हिन्दी)</option>
                <option value="ta-IN">Tamil (தமிழ்)</option>
                <option value="te-IN">Telugu (తెలుగు)</option>
                <option value="bn-IN">Bengali (বাংলা)</option>
                <option value="mr-IN">Marathi (मराठी)</option>
              </select>
            </div>

            {transcript && (
              <div className={styles.transcriptBox}>
                <span className={styles.label}>Command:</span> {transcript}
              </div>
            )}

            {lastReply && (
              <div className={styles.replyBox}>
                <span className={styles.label}>Sarvam Operator:</span> {lastReply}
              </div>
            )}

            {processing && <div className={styles.statusText}>Processing command & orchestrating tools...</div>}
            {recording && <div className={styles.statusTextListening}>🔴 Listening... Speak command now</div>}
          </div>
        </div>
      )}

      <button
        className={`${styles.fab} ${recording ? styles.fabRecording : ""}`}
        onClick={() => {
          if (!isOpen) setIsOpen(true);
          toggleRecording();
        }}
        title="Sarvam AI Global Voice Operator"
        aria-label="Sarvam AI Global Voice Operator"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      </button>
    </div>
  );
}
