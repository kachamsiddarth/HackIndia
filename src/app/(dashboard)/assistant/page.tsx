"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";

type SarvamLanguage =
  | "en-IN" | "hi-IN" | "ta-IN" | "te-IN" | "kn-IN"
  | "ml-IN" | "bn-IN" | "gu-IN" | "mr-IN" | "pa-IN" | "or-IN";

const LANGUAGE_OPTIONS: { value: SarvamLanguage; label: string; speechCode: string }[] = [
  { value: "en-IN", label: "English", speechCode: "en-IN" },
  { value: "hi-IN", label: "हिन्दी (Hindi)", speechCode: "hi-IN" },
  { value: "ta-IN", label: "தமிழ் (Tamil)", speechCode: "ta-IN" },
  { value: "te-IN", label: "తెలుగు (Telugu)", speechCode: "te-IN" },
  { value: "kn-IN", label: "ಕನ್ನಡ (Kannada)", speechCode: "kn-IN" },
  { value: "ml-IN", label: "മലയാളം (Malayalam)", speechCode: "ml-IN" },
  { value: "bn-IN", label: "বাংলা (Bengali)", speechCode: "bn-IN" },
  { value: "gu-IN", label: "ગુજરાતી (Gujarati)", speechCode: "gu-IN" },
  { value: "mr-IN", label: "मराठी (Marathi)", speechCode: "mr-IN" },
  { value: "pa-IN", label: "ਪੰਜਾਬੀ (Punjabi)", speechCode: "pa-IN" },
  { value: "or-IN", label: "ଓଡ଼ିଆ (Odia)", speechCode: "or-IN" },
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
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<unknown | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

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
  }, [messages, sending]);

  // Clean audio on unmount
  useEffect(() => {
    return () => {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Speech output function (TTS)
  const speakText = async (text: string, msgId: string, langCode: SarvamLanguage) => {
    // Stop any existing speech
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    if (speakingId === msgId) {
      setSpeakingId(null);
      return;
    }

    setSpeakingId(msgId);

    // Try Sarvam TTS API first
    try {
      const res = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "tts",
          text: text.slice(0, 500), // Sarvam limit per request
          language: langCode,
        }),
      });

      const json = await res.json();
      if (json.data?.audioBase64) {
        const audioSrc = `data:audio/wav;base64,${json.data.audioBase64}`;
        const audio = new Audio(audioSrc);
        currentAudioRef.current = audio;

        audio.onended = () => setSpeakingId(null);
        audio.onerror = () => fallbackWebSpeech(text, langCode);
        await audio.play();
        return;
      }
    } catch {
      // ignore and fallback
    }

    // Fallback: Browser Web Speech Synthesis
    fallbackWebSpeech(text, langCode);
  };

  const fallbackWebSpeech = (text: string, langCode: SarvamLanguage) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setSpeakingId(null);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    const speechLang = LANGUAGE_OPTIONS.find((l) => l.value === langCode)?.speechCode || "en-IN";
    utterance.lang = speechLang;
    utterance.rate = 0.95;

    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);

    window.speechSynthesis.speak(utterance);
  };

  // Send message
  const handleSend = async (textToSend?: string) => {
    const msg = (textToSend ?? input).trim();
    if (!msg || sending) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
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
      const newMsgId = crypto.randomUUID();

      const assistantMsg: ChatMessage = {
        id: newMsgId,
        role: "assistant",
        content: reply,
        language,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // Auto-speak response if enabled
      if (autoSpeak) {
        void speakText(reply, newMsgId, language);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Network error. Please check your connection and try again.",
          language: "en-IN",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  // Voice recording (Speech-to-Text)
  const toggleRecording = () => {
    if (recording) {
      if (recognitionRef.current) {
        try {
          (recognitionRef.current as { stop: () => void }).stop();
        } catch {
          // ignore
        }
      }
      setRecording(false);
      return;
    }

    if (typeof window === "undefined") return;

    // Check for SpeechRecognition support
    const SpeechRecognitionWindow =
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition;

    if (!SpeechRecognitionWindow) {
      alert("Speech recognition is not supported in this browser. Please use Google Chrome, Edge, or Brave.");
      return;
    }

    try {
      const recognition = new (SpeechRecognitionWindow as new () => {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        onresult: (e: {
          resultIndex: number;
          results: { [key: number]: { transcript: string } }[];
        }) => void;
        onerror: (e: { error: string }) => void;
        onend: () => void;
        start: () => void;
        stop: () => void;
      })();

      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = LANGUAGE_OPTIONS.find((l) => l.value === language)?.speechCode || "en-IN";

      recognitionRef.current = recognition;

      recognition.onresult = (event) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setInput(transcript);
      };

      recognition.onerror = (err) => {
        console.warn("Speech recognition error:", err);
        setRecording(false);
      };

      recognition.onend = () => {
        setRecording(false);
      };

      recognition.start();
      setRecording(true);
    } catch (err) {
      console.error("Failed to start speech recognition:", err);
      setRecording(false);
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
      {/* Header with language selector and Auto-Speak toggle */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <span className={styles.title}>🤖 Sarvam AI Voice & Text Assistant</span>
          <span className={styles.subtitle}>WCAG 2.2 AA Accessibility Specialist</span>
        </div>

        <div className={styles.controls}>
          <label className={styles.autoSpeakToggle}>
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={autoSpeak}
              onChange={(e) => setAutoSpeak(e.target.checked)}
            />
            🔊 Auto-Speak Answers
          </label>

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
            <span className={styles.emptyIcon}>🎙️</span>
            <span className={styles.emptyTitle}>Voice & Multilingual Assistance Ready</span>
            <span className={styles.emptyHint}>
              Click the microphone button to speak, or type your question. Responses can be spoken aloud in Hindi, Tamil, Telugu, Bengali, Kannada, Marathi, and 5 other Indian languages!
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
              className={`${styles.messageWrapper} ${
                msg.role === "user" ? styles.userWrapper : styles.assistantWrapper
              }`}
            >
              <div
                className={`${styles.message} ${
                  msg.role === "user" ? styles.userMsg : styles.assistantMsg
                }`}
              >
                {msg.content}
              </div>

              {msg.role === "assistant" && (
                <div className={styles.msgFooter}>
                  <button
                    className={`${styles.speakBtn} ${
                      speakingId === msg.id ? styles.speakingActive : ""
                    }`}
                    onClick={() =>
                      void speakText(msg.content, msg.id, msg.language as SarvamLanguage)
                    }
                    title="Speak text out loud using Sarvam AI voice"
                    type="button"
                  >
                    {speakingId === msg.id ? "⏸️ Pause Audio" : "🔊 Listen"}
                  </button>
                </div>
              )}
            </div>
          ))
        )}

        {sending && <div className={styles.typing}>Sarvam AI is thinking and translating…</div>}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className={styles.inputArea}>
        {recording && (
          <div className={styles.recordingStatus}>
            <span className={styles.recordingDot} />
            🎙️ Listening... Speak now!
          </div>
        )}

        <div className={styles.inputRow}>
          <button
            className={`${styles.voiceBtn} ${recording ? styles.voiceActive : ""}`}
            onClick={toggleRecording}
            title={recording ? "Click to stop listening" : "Click to speak via Microphone"}
            aria-label={recording ? "Stop voice listening" : "Start voice listening"}
            type="button"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
              recording
                ? "Listening to your voice..."
                : language === "en-IN"
                ? "Ask about accessibility, WCAG rules, or code fixes…"
                : "Type or speak your question in your selected language…"
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
    </div>
  );
}
