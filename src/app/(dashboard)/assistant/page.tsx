"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";

type SarvamLanguage =
  | "en-IN" | "hi-IN" | "ta-IN" | "te-IN" | "kn-IN"
  | "ml-IN" | "bn-IN" | "gu-IN" | "mr-IN" | "pa-IN" | "or-IN";

const LANGUAGE_OPTIONS: { value: SarvamLanguage; label: string }[] = [
  { value: "en-IN", label: "English" },
  { value: "hi-IN", label: "हिन्दी (Hindi)" },
  { value: "ta-IN", label: "தமிழ் (Tamil)" },
  { value: "te-IN", label: "తెలుగు (Telugu)" },
  { value: "kn-IN", label: "ಕನ್ನಡ (Kannada)" },
  { value: "ml-IN", label: "മലയാളം (Malayalam)" },
  { value: "bn-IN", label: "বাংলা (Bengali)" },
  { value: "gu-IN", label: "ગુજરાતી (Gujarati)" },
  { value: "mr-IN", label: "मराठी (Marathi)" },
  { value: "pa-IN", label: "ਪੰਜਾਬੀ (Punjabi)" },
  { value: "or-IN", label: "ଓଡ଼ିଆ (Odia)" },
];

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  language: string;
  created_at?: string;
}

export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [language, setLanguage] = useState<SarvamLanguage>("en-IN");
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Load chat history
  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch("/api/chat");
        const json = await res.json();
        if (json.data?.messages) {
          setMessages(json.data.messages);
        }
      } catch {
        // ignore
      }
    }
    void loadHistory();
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send message
  const handleSend = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: msg,
      language,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, language }),
      });
      const json = await res.json();

      const reply = json.data?.reply || json.error?.message || "Sorry, I couldn't process that.";
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: reply,
        language,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Network error. Please try again.",
          language: "en-IN",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  // Voice recording
  const toggleRecording = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });

        // Convert to base64
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(",")[1];
          if (!base64) return;

          try {
            const res = await fetch("/api/voice", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "stt", audioBase64: base64, language }),
            });
            const json = await res.json();
            if (json.data?.transcript) {
              setInput(json.data.transcript);
            }
          } catch {
            // fallback: use Web Speech API
          }
        };
        reader.readAsDataURL(blob);
      };

      mediaRecorder.start();
      setRecording(true);
    } catch {
      // Fallback: Web Speech API
      if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
        const SpeechRecognition =
          (window as unknown as Record<string, unknown>).SpeechRecognition ||
          (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
        const recognition = new (SpeechRecognition as new () => {
          lang: string;
          onresult: (e: { results: { transcript: string }[][] }) => void;
          onerror: () => void;
          onend: () => void;
          start: () => void;
        })();
        recognition.lang = language;
        recognition.onresult = (e: { results: { transcript: string }[][] }) => {
          setInput(e.results[0][0].transcript);
        };
        recognition.onerror = () => setRecording(false);
        recognition.onend = () => setRecording(false);
        recognition.start();
        setRecording(true);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className={styles.container}>
      {/* Header with language selector */}
      <div className={styles.header}>
        <span className={styles.title}>🤖 Sarvam AI Assistant</span>
        <div className={styles.controls}>
          <select
            className={styles.langSelect}
            value={language}
            onChange={(e) => setLanguage(e.target.value as SarvamLanguage)}
            aria-label="Select language"
          >
            {LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Messages */}
      <div className={styles.messages}>
        {messages.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>💬</span>
            <span className={styles.emptyTitle}>Start a Conversation</span>
            <span className={styles.emptyHint}>
              Ask me about WCAG rules, accessibility fixes, or how to improve your project's compliance score. I support 11 Indian languages!
            </span>
            <div className={styles.suggestions}>
              <button
                className={styles.suggestionChip}
                onClick={() => void handleSend("What is WCAG 2.2 AA?")}
              >
                What is WCAG 2.2 AA?
              </button>
              <button
                className={styles.suggestionChip}
                onClick={() => void handleSend("How do I add alt text to images?")}
              >
                How to add alt text?
              </button>
              <button
                className={styles.suggestionChip}
                onClick={() => void handleSend("Explain ARIA roles and landmarks")}
              >
                Explain ARIA roles
              </button>
              <button
                className={styles.suggestionChip}
                onClick={() => void handleSend("How to make forms accessible?")}
              >
                Accessible forms
              </button>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`${styles.message} ${
                msg.role === "user" ? styles.userMsg : styles.assistantMsg
              }`}
            >
              {msg.content}
            </div>
          ))
        )}

        {sending && <div className={styles.typing}>Sarvam AI is thinking…</div>}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className={styles.inputArea}>
        <button
          className={`${styles.voiceBtn} ${recording ? styles.voiceActive : ""}`}
          onClick={toggleRecording}
          title={recording ? "Stop recording" : "Start voice input"}
          aria-label={recording ? "Stop voice recording" : "Start voice recording"}
          type="button"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </button>

        <input
          className={styles.chatInput}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            language === "en-IN"
              ? "Ask about accessibility, WCAG rules, or code fixes…"
              : "Type your question in any language…"
          }
          disabled={sending}
        />

        <button
          className={styles.sendBtn}
          onClick={() => void handleSend()}
          disabled={!input.trim() || sending}
          title="Send message"
          aria-label="Send message"
          type="button"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
