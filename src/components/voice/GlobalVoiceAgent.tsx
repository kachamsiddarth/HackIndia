"use client";

import { useState, useRef } from "react";
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
  const transcriptRef = useRef("");
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

  // Inspect the Live Repository Preview iframe if on /experience page
  const inspectLiveRepositoryPreview = () => {
    if (!pathname.includes("/experience")) return null;

    const iframe = document.querySelector("iframe") as HTMLIFrameElement | null;
    if (!iframe || !iframe.contentDocument) return null;

    const doc = iframe.contentDocument;
    const title = doc.querySelector("h1, h2, h3")?.textContent || "Imported Repository UI";
    
    // Extract full text content & sections
    const headings = Array.from(doc.querySelectorAll("h1, h2, h3, h4")).map(h => h.textContent?.trim()).filter(Boolean);
    const textSnippet = (doc.body?.innerText || "").slice(0, 1500);

    // Find interactive elements inside preview
    const buttons = Array.from(doc.querySelectorAll("button")).map((b, i) => b.textContent?.trim() || `Button ${i + 1}`);
    const links = Array.from(doc.querySelectorAll("a")).map((a, i) => a.textContent?.trim() || `Link ${i + 1}`);
    const inputs = Array.from(doc.querySelectorAll("input, select, textarea")).map((inp: any, i) => inp.placeholder || inp.name || `Input ${i + 1}`);

    return {
      title,
      headings,
      textSnippet,
      buttons,
      links,
      inputs,
      allInteractive: [...buttons, ...links, ...inputs]
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

    // Special behavior for Experience Mode: pass live repository preview content as context into agent query
    let previewContextStr = "";
    if (pathname.includes("/experience")) {
      const previewData = inspectLiveRepositoryPreview();
      if (previewData) {
        previewContextStr = `[Active Webpage Live Preview Context - Title: "${previewData.title}". Headings: ${previewData.headings.join(", ")}. Text Content: ${previewData.textSnippet}. Interactive Elements: ${previewData.allInteractive.join(", ")}]`;
      }
    }

    try {
      const context = extractContextFromUrl();
      const messageWithPreviewContext = previewContextStr ? `${previewContextStr} User Question: ${commandText}` : commandText;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageWithPreviewContext,
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

      recognition.onerror = (err: any) => {
        console.warn("Speech recognition error:", err);
        setRecording(false);
      };

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
    } catch (e) {
      console.error("Failed to start speech recognition:", e);
      setRecording(false);
    }
  };

  return (
    <div className={styles.container}>
      {isOpen && (
        <div className={styles.popover}>
          <div className={styles.popoverHeader}>
            <span className={styles.title}>🎙️ DIFF — Voice Accessibility Agent</span>
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
                <span className={styles.label}>DIFF Agent:</span> {lastReply}
              </div>
            )}

            {processing && <div className={styles.statusText}>DIFF is inspecting & responding...</div>}
            {recording && <div className={styles.statusTextListening}>🔴 Listening... Say "Hey DIFF" or speak command</div>}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const input = form.elements.namedItem("textCommand") as HTMLInputElement;
                if (input && input.value.trim()) {
                  void handleCommandSend(input.value.trim());
                  input.value = "";
                }
              }}
              style={{ display: "flex", gap: "6px", marginTop: "6px" }}
            >
              <input
                type="text"
                name="textCommand"
                placeholder="Type command or question..."
                style={{
                  flex: 1,
                  background: "#09090b",
                  border: "1px solid #3f3f46",
                  color: "#f4f4f5",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  fontSize: "0.75rem",
                  outline: "none",
                }}
              />
              <button
                type="submit"
                disabled={processing}
                style={{
                  background: "#f97316",
                  color: "#ffffff",
                  border: "none",
                  padding: "6px 12px",
                  borderRadius: "6px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}

      <button
        className={`${styles.fab} ${recording ? styles.fabRecording : ""}`}
        onClick={() => {
          if (!isOpen) setIsOpen(true);
          toggleRecording();
        }}
        title="DIFF — Sarvam Voice Guide Agent (Say 'Hey DIFF')"
        aria-label="DIFF — Sarvam Voice Guide Agent"
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
